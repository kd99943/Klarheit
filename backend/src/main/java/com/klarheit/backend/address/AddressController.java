package com.klarheit.backend.address;

import com.klarheit.backend.address.dto.AddressRequestDTO;
import com.klarheit.backend.address.dto.AddressResponseDTO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/addresses")
public class AddressController {
    private final AddressService addressService;

    public AddressController(AddressService addressService) {
        this.addressService = addressService;
    }

    @GetMapping
    public ResponseEntity<List<AddressResponseDTO>> getAddresses(Authentication authentication) {
        return ResponseEntity.ok(addressService.getAddresses(authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<AddressResponseDTO> createAddress(
            @Valid @RequestBody AddressRequestDTO request, Authentication authentication) {
        return ResponseEntity.ok(addressService.createAddress(request, authentication.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AddressResponseDTO> updateAddress(
            @PathVariable Long id, @Valid @RequestBody AddressRequestDTO request, Authentication authentication) {
        return ResponseEntity.ok(addressService.updateAddress(id, request, authentication.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAddress(@PathVariable Long id, Authentication authentication) {
        addressService.deleteAddress(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/default")
    public ResponseEntity<AddressResponseDTO> setDefaultAddress(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(addressService.setDefaultAddress(id, authentication.getName()));
    }
}
