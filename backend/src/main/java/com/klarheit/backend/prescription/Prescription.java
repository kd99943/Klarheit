package com.klarheit.backend.prescription;

import com.klarheit.backend.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "prescriptions")
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false, length = 255)
    private String userEmail;

    @Column(name = "sph_od", nullable = false, precision = 6, scale = 2)
    private BigDecimal sphOd;

    @Column(name = "sph_os", nullable = false, precision = 6, scale = 2)
    private BigDecimal sphOs;

    @Column(name = "cyl_od", nullable = false, precision = 6, scale = 2)
    private BigDecimal cylOd;

    @Column(name = "cyl_os", nullable = false, precision = 6, scale = 2)
    private BigDecimal cylOs;

    @Column(name = "axis_od", nullable = false)
    private Integer axisOd;

    @Column(name = "axis_os", nullable = false)
    private Integer axisOs;

    @Column(name = "pd", nullable = false, precision = 6, scale = 2)
    private BigDecimal pd;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private UserAccount user;
}
