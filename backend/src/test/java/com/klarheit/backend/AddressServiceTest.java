package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.klarheit.backend.address.Address;
import com.klarheit.backend.address.AddressRepository;
import com.klarheit.backend.address.AddressService;
import com.klarheit.backend.address.dto.AddressRequestDTO;
import com.klarheit.backend.address.dto.AddressResponseDTO;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AddressServiceTest {

    @Mock
    private AddressRepository addressRepository;

    @Mock
    private UserService userService;

    @InjectMocks
    private AddressService addressService;

    private UserAccount mockUser;

    @BeforeEach
    void setUp() {
        mockUser = UserAccount.builder()
                .id(100L)
                .email("test@example.com")
                .firstName("John")
                .lastName("Doe")
                .build();
    }

    @Test
    void getAddressesReturnsListOrdered() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        
        Address addr1 = Address.builder().id(1L).recipientName("Recipient 1").phoneNumber("123").province("P").city("C").detailAddress("D").isDefault(true).build();
        Address addr2 = Address.builder().id(2L).recipientName("Recipient 2").phoneNumber("456").province("P").city("C").detailAddress("D2").isDefault(false).build();
        
        when(addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(100L))
                .thenReturn(List.of(addr1, addr2));

        List<AddressResponseDTO> result = addressService.getAddresses("test@example.com");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).recipientName()).isEqualTo("Recipient 1");
        assertThat(result.get(0).isDefault()).isTrue();
        assertThat(result.get(1).recipientName()).isEqualTo("Recipient 2");
        assertThat(result.get(1).isDefault()).isFalse();
    }

    @Test
    void createFirstAddressEnforcesDefault() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        when(addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(100L)).thenReturn(List.of());
        when(addressRepository.save(any(Address.class))).thenAnswer(invocation -> {
            Address arg = invocation.getArgument(0);
            arg.setId(1L);
            return arg;
        });

        AddressRequestDTO request = new AddressRequestDTO("John Doe", "123456", "Guangdong", "Shenzhen", "Nanshan", "Keyuan Rd", false);

        AddressResponseDTO response = addressService.createAddress(request, "test@example.com");

        assertThat(response.isDefault()).isTrue();
        verify(addressRepository).save(any(Address.class));
    }

    @Test
    void createDefaultAddressClearsPreviousDefaults() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        
        Address oldDefault = Address.builder().id(1L).userId(100L).recipientName("Old").isDefault(true).build();
        
        when(addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(100L))
                .thenReturn(List.of(oldDefault));

        AddressRequestDTO request = new AddressRequestDTO("New", "123456", "Guangdong", "Shenzhen", "", "Keyuan Rd", true);

        when(addressRepository.save(any(Address.class))).thenAnswer(invocation -> {
            Address arg = invocation.getArgument(0);
            if (arg.getId() == null) {
                arg.setId(2L);
            }
            return arg;
        });

        AddressResponseDTO response = addressService.createAddress(request, "test@example.com");

        // Verify previous default was cleared
        assertThat(oldDefault.isDefault()).isFalse();
        verify(addressRepository, times(2)).save(any(Address.class)); // 1 for old, 1 for new
        assertThat(response.isDefault()).isTrue();
    }

    @Test
    void updateAddressChangesDefaultAndClearsOld() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));

        Address address = Address.builder().id(1L).userId(100L).recipientName("Old Name").isDefault(false).build();
        Address oldDefault = Address.builder().id(2L).userId(100L).recipientName("Old Default").isDefault(true).build();

        when(addressRepository.findByIdAndUserId(1L, 100L)).thenReturn(Optional.of(address));
        when(addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(100L)).thenReturn(List.of(oldDefault, address));
        
        AddressRequestDTO request = new AddressRequestDTO("New Name", "123456", "Guangdong", "Shenzhen", "", "Keyuan Rd", true);
        
        when(addressRepository.save(any(Address.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AddressResponseDTO response = addressService.updateAddress(1L, request, "test@example.com");

        assertThat(oldDefault.isDefault()).isFalse();
        assertThat(response.recipientName()).isEqualTo("New Name");
        assertThat(response.isDefault()).isTrue();
        verify(addressRepository).save(oldDefault);
        verify(addressRepository).save(address);
    }

    @Test
    void deleteDefaultAddressAssignsNewDefault() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));

        Address defaultAddr = Address.builder().id(1L).userId(100L).recipientName("To Delete").isDefault(true).build();
        Address nextAddr = Address.builder().id(2L).userId(100L).recipientName("Next").isDefault(false).build();

        when(addressRepository.findByIdAndUserId(1L, 100L)).thenReturn(Optional.of(defaultAddr));
        when(addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(100L)).thenReturn(List.of(nextAddr));
        when(addressRepository.save(any(Address.class))).thenAnswer(invocation -> invocation.getArgument(0));

        addressService.deleteAddress(1L, "test@example.com");

        verify(addressRepository).delete(defaultAddr);
        assertThat(nextAddr.isDefault()).isTrue();
        verify(addressRepository).save(nextAddr);
    }

    @Test
    void updateAddress_throwsIllegalArgumentExceptionWhenNotFoundOrUnauthorized() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        when(addressRepository.findByIdAndUserId(999L, 100L)).thenReturn(Optional.empty());

        AddressRequestDTO request = new AddressRequestDTO("John Doe", "123456", "Guangdong", "Shenzhen", "", "Keyuan Rd", false);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> 
            addressService.updateAddress(999L, request, "test@example.com")
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Address not found or unauthorized");

        verify(addressRepository, never()).save(any(Address.class));
    }

    @Test
    void deleteAddress_throwsIllegalArgumentExceptionWhenNotFoundOrUnauthorized() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        when(addressRepository.findByIdAndUserId(999L, 100L)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> 
            addressService.deleteAddress(999L, "test@example.com")
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Address not found or unauthorized");

        verify(addressRepository, never()).delete(any(Address.class));
    }

    @Test
    void setDefaultAddress_throwsIllegalArgumentExceptionWhenNotFoundOrUnauthorized() {
        when(userService.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(mockUser));
        when(addressRepository.findByIdAndUserId(999L, 100L)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> 
            addressService.setDefaultAddress(999L, "test@example.com")
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Address not found or unauthorized");

        verify(addressRepository, never()).save(any(Address.class));
    }
}
