package com.klarheit.backend.address;

import com.klarheit.backend.address.dto.AddressRequestDTO;
import com.klarheit.backend.address.dto.AddressResponseDTO;
import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.auth.UserService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AddressService {
    private final AddressRepository addressRepository;
    private final UserService userService;

    public AddressService(AddressRepository addressRepository, UserService userService) {
        this.addressRepository = addressRepository;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public List<AddressResponseDTO> getAddresses(String email) {
        UserAccount user = getUserOrThrow(email);
        return addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponseDTO)
                .toList();
    }

    @Transactional
    public AddressResponseDTO createAddress(AddressRequestDTO request, String email) {
        UserAccount user = getUserOrThrow(email);
        List<Address> existing = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
        
        boolean shouldBeDefault = request.isDefault() || existing.isEmpty();
        
        if (shouldBeDefault) {
            clearDefaults(user.getId());
        }

        Address address = Address.builder()
                .userId(user.getId())
                .recipientName(request.recipientName().trim())
                .phoneNumber(request.phoneNumber().trim())
                .province(request.province().trim())
                .city(request.city().trim())
                .district(request.district() != null ? request.district().trim() : null)
                .detailAddress(request.detailAddress().trim())
                .isDefault(shouldBeDefault)
                .build();

        Address saved = addressRepository.save(address);
        return toResponseDTO(saved);
    }

    @Transactional
    public AddressResponseDTO updateAddress(Long id, AddressRequestDTO request, String email) {
        UserAccount user = getUserOrThrow(email);
        Address address = addressRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Address not found or unauthorized"));

        boolean oldDefault = address.isDefault();
        boolean newDefault = request.isDefault();

        if (newDefault && !oldDefault) {
            clearDefaults(user.getId());
            address.setDefault(true);
        } else if (!newDefault && oldDefault) {
            // Keep default if it is the only address, otherwise reset
            List<Address> existing = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
            if (existing.size() > 1) {
                address.setDefault(false);
                // Set the next one as default
                Address next = existing.stream().filter(a -> !a.getId().equals(id)).findFirst().orElse(null);
                if (next != null) {
                    next.setDefault(true);
                    addressRepository.save(next);
                }
            } else {
                address.setDefault(true);
            }
        }

        address.setRecipientName(request.recipientName().trim());
        address.setPhoneNumber(request.phoneNumber().trim());
        address.setProvince(request.province().trim());
        address.setCity(request.city().trim());
        address.setDistrict(request.district() != null ? request.district().trim() : null);
        address.setDetailAddress(request.detailAddress().trim());

        Address updated = addressRepository.save(address);
        return toResponseDTO(updated);
    }

    @Transactional
    public void deleteAddress(Long id, String email) {
        UserAccount user = getUserOrThrow(email);
        Address address = addressRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Address not found or unauthorized"));

        boolean wasDefault = address.isDefault();
        addressRepository.delete(address);

        if (wasDefault) {
            List<Address> remaining = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
            if (!remaining.isEmpty()) {
                Address newDefault = remaining.get(0);
                newDefault.setDefault(true);
                addressRepository.save(newDefault);
            }
        }
    }

    @Transactional
    public AddressResponseDTO setDefaultAddress(Long id, String email) {
        UserAccount user = getUserOrThrow(email);
        Address address = addressRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Address not found or unauthorized"));

        if (!address.isDefault()) {
            clearDefaults(user.getId());
            address.setDefault(true);
            address = addressRepository.save(address);
        }
        return toResponseDTO(address);
    }

    private void clearDefaults(Long userId) {
        addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId)
                .forEach(a -> {
                    if (a.isDefault()) {
                        a.setDefault(false);
                        addressRepository.save(a);
                    }
                });
    }

    private UserAccount getUserOrThrow(String email) {
        return userService.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found."));
    }

    private AddressResponseDTO toResponseDTO(Address address) {
        return new AddressResponseDTO(
                address.getId(),
                address.getRecipientName(),
                address.getPhoneNumber(),
                address.getProvince(),
                address.getCity(),
                address.getDistrict(),
                address.getDetailAddress(),
                address.isDefault()
        );
    }
}
