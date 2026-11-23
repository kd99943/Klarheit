package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.klarheit.backend.aftersales.AfterSalesService;
import com.klarheit.backend.aftersales.AfterSalesTicket;
import com.klarheit.backend.aftersales.AfterSalesTicketRepository;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketRequestDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketResponseDTO;
import com.klarheit.backend.aftersales.dto.AfterSalesTicketUpdateDTO;
import com.klarheit.backend.audit.AuditLogService;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import com.klarheit.backend.order.Order;
import com.klarheit.backend.order.OrderRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AfterSalesServiceTest {

    @Mock
    private AfterSalesTicketRepository ticketRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private UserService userService;
    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private AfterSalesService afterSalesService;

    private UserAccount owner;
    private Order order;

    @BeforeEach
    void setUp() {
        owner = UserAccount.builder().id(10L).email("owner@example.com").role("USER").build();
        order = Order.builder()
                .id(1L)
                .orderNumber("KL-20261122-000001")
                .userId(10L)
                .customerEmail("owner@example.com")
                .customerPhone("13800138000")
                .build();
    }

    @Test
    void createTicketSucceedsForOrderOwner() {
        when(userService.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        when(orderRepository.findByOrderNumber("KL-20261122-000001")).thenReturn(Optional.of(order));
        when(ticketRepository.save(any(AfterSalesTicket.class))).thenAnswer(i -> i.getArgument(0));

        AfterSalesTicketResponseDTO created = afterSalesService.createTicket(
                "KL-20261122-000001",
                new AfterSalesTicketRequestDTO("FIT_DISCOMFORT", "左眼佩戴略微头晕，希望复核轴位", null),
                "owner@example.com"
        );

        assertThat(created.ticketNumber()).startsWith("AS-");
        assertThat(created.category()).isEqualTo("FIT_DISCOMFORT");
        assertThat(created.status()).isEqualTo("OPEN");
        assertThat(created.contactInfo()).isEqualTo("13800138000");
    }

    @Test
    void createTicketRejectsNonOwnerAndInvalidCategory() {
        UserAccount stranger = UserAccount.builder().id(99L).email("stranger@example.com").role("USER").build();
        when(userService.findByEmailIgnoreCase("stranger@example.com")).thenReturn(Optional.of(stranger));
        when(orderRepository.findByOrderNumber("KL-20261122-000001")).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> afterSalesService.createTicket(
                "KL-20261122-000001",
                new AfterSalesTicketRequestDTO("DAMAGED", "broken", null),
                "stranger@example.com"
        )).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Unauthorized");

        when(userService.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(owner));
        assertThatThrownBy(() -> afterSalesService.createTicket(
                "KL-20261122-000001",
                new AfterSalesTicketRequestDTO("INVALID_CAT", "reason", null),
                "owner@example.com"
        )).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Unsupported support category");
    }

    @Test
    void updateTicketForAdminUpdatesFieldsAndAuditLogs() {
        AfterSalesTicket ticket = new AfterSalesTicket();
        ticket.setTicketNumber("AS-100");
        ticket.setOrderNumber("KL-20261122-000001");
        ticket.setStatus("OPEN");
        when(ticketRepository.findByTicketNumber("AS-100")).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any(AfterSalesTicket.class))).thenAnswer(i -> i.getArgument(0));

        LocalDateTime nextContact = LocalDateTime.now().plusDays(1);
        AfterSalesTicketResponseDTO updated = afterSalesService.updateTicketForAdmin(
                "AS-100",
                new AfterSalesTicketUpdateDTO("IN_PROGRESS", "验配师王工", "已联系用户核对原验光单，安排免费重做", nextContact),
                "admin@klarheit.com"
        );

        assertThat(updated.status()).isEqualTo("IN_PROGRESS");
        assertThat(updated.assignee()).isEqualTo("验配师王工");
        assertThat(updated.resolutionNote()).contains("免费重做");
        verify(auditLogService).log(eq("admin@klarheit.com"), eq("UPDATE_AFTER_SALES_TICKET"), eq("AFTER_SALES"), eq("AS-100"), any());
    }
}
