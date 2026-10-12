package com.klarheit.backend;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.klarheit.backend.address.AddressController;
import com.klarheit.backend.address.AddressService;
import com.klarheit.backend.address.dto.AddressRequestDTO;
import com.klarheit.backend.address.dto.AddressResponseDTO;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class AddressControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AddressService addressService;

    @InjectMocks
    private AddressController addressController;

    private Authentication mockAuthentication;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(addressController).build();
        mockAuthentication = mock(Authentication.class);
        lenient().when(mockAuthentication.getName()).thenReturn("test@example.com");
        objectMapper = new ObjectMapper();
    }

    @Test
    void getAddressesReturnsList() throws Exception {
        AddressResponseDTO address1 = new AddressResponseDTO(
                1L, "John Doe", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Road", true);
        AddressResponseDTO address2 = new AddressResponseDTO(
                2L, "Jane Doe", "654321", "Guangdong", "Shenzhen", "Nanshan", "Yuehai Road", false);

        when(addressService.getAddresses("test@example.com")).thenReturn(List.of(address1, address2));

        mockMvc.perform(get("/api/v1/addresses")
                        .principal(mockAuthentication)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].recipientName").value("John Doe"))
                .andExpect(jsonPath("$[0].isDefault").value(true))
                .andExpect(jsonPath("$[1].id").value(2))
                .andExpect(jsonPath("$[1].recipientName").value("Jane Doe"))
                .andExpect(jsonPath("$[1].isDefault").value(false));

        verify(addressService).getAddresses("test@example.com");
    }

    @Test
    void createAddressSucceeds() throws Exception {
        AddressRequestDTO request = new AddressRequestDTO(
                "John Doe", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Road", true);
        AddressResponseDTO response = new AddressResponseDTO(
                1L, "John Doe", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Road", true);

        when(addressService.createAddress(any(AddressRequestDTO.class), eq("test@example.com")))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/addresses")
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.recipientName").value("John Doe"))
                .andExpect(jsonPath("$.isDefault").value(true));

        verify(addressService).createAddress(any(AddressRequestDTO.class), eq("test@example.com"));
    }

    @Test
    void createAddressValidationFailureReturns400() throws Exception {
        // Empty fields which violate validation rules
        AddressRequestDTO invalidRequest = new AddressRequestDTO(
                "", "", "", "", "", "", false);

        mockMvc.perform(post("/api/v1/addresses")
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());

        verify(addressService, never()).createAddress(any(), any());
    }

    @Test
    void updateAddressSucceeds() throws Exception {
        AddressRequestDTO request = new AddressRequestDTO(
                "John Doe Updated", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Road", true);
        AddressResponseDTO response = new AddressResponseDTO(
                1L, "John Doe Updated", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Road", true);

        when(addressService.updateAddress(eq(1L), any(AddressRequestDTO.class), eq("test@example.com")))
                .thenReturn(response);

        mockMvc.perform(put("/api/v1/addresses/{id}", 1L)
                        .principal(mockAuthentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.recipientName").value("John Doe Updated"));

        verify(addressService).updateAddress(eq(1L), any(AddressRequestDTO.class), eq("test@example.com"));
    }

    @Test
    void deleteAddressSucceeds() throws Exception {
        doNothing().when(addressService).deleteAddress(1L, "test@example.com");

        mockMvc.perform(delete("/api/v1/addresses/{id}", 1L)
                        .principal(mockAuthentication))
                .andExpect(status().isNoContent());

        verify(addressService).deleteAddress(1L, "test@example.com");
    }

    @Test
    void setDefaultAddressSucceeds() throws Exception {
        AddressResponseDTO response = new AddressResponseDTO(
                1L, "John Doe", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Road", true);

        when(addressService.setDefaultAddress(1L, "test@example.com")).thenReturn(response);

        mockMvc.perform(post("/api/v1/addresses/{id}/default", 1L)
                        .principal(mockAuthentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.isDefault").value(true));

        verify(addressService).setDefaultAddress(1L, "test@example.com");
    }
}
