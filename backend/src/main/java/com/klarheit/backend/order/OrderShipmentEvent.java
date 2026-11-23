package com.klarheit.backend.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "order_shipment_events")
public class OrderShipmentEvent {
    public static final String TYPE_INITIAL_SHIP = "INITIAL_SHIP";
    public static final String TYPE_TRACKING_UPDATE = "TRACKING_UPDATE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, length = 64)
    private String orderNumber;

    @Column(name = "event_type", nullable = false, length = 32)
    private String eventType;

    @Column(nullable = false, length = 100)
    private String carrier;

    @Column(name = "tracking_number", nullable = false, length = 100)
    private String trackingNumber;

    @Column(name = "previous_carrier", length = 100)
    private String previousCarrier;

    @Column(name = "previous_tracking_number", length = 100)
    private String previousTrackingNumber;

    @Column(length = 512)
    private String note;

    @Column(name = "operator_email", length = 120)
    private String operatorEmail;

    @Column(name = "notification_sent", nullable = false)
    private boolean notificationSent = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = BusinessClock.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getCarrier() { return carrier; }
    public void setCarrier(String carrier) { this.carrier = carrier; }
    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }
    public String getPreviousCarrier() { return previousCarrier; }
    public void setPreviousCarrier(String previousCarrier) { this.previousCarrier = previousCarrier; }
    public String getPreviousTrackingNumber() { return previousTrackingNumber; }
    public void setPreviousTrackingNumber(String previousTrackingNumber) { this.previousTrackingNumber = previousTrackingNumber; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getOperatorEmail() { return operatorEmail; }
    public void setOperatorEmail(String operatorEmail) { this.operatorEmail = operatorEmail; }
    public boolean isNotificationSent() { return notificationSent; }
    public void setNotificationSent(boolean notificationSent) { this.notificationSent = notificationSent; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
