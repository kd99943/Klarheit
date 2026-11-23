package com.klarheit.backend.config;

import com.klarheit.backend.order.QuoteVersionConflictException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.LazyInitializationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse("Bad Request", exception.getMessage(), List.of()));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleEntityNotFound(EntityNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiErrorResponse("Not Found", exception.getMessage(), List.of()));
    }

    @ExceptionHandler(QuoteVersionConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleQuoteVersionConflict(QuoteVersionConflictException exception) {
        log.warn("Quote version conflict: {} (currentVersion={})", exception.getMessage(), exception.getCurrentQuoteVersion());
        List<String> details = exception.getCurrentQuoteVersion() != null
                ? List.of("QUOTE_VERSION_CONFLICT", "currentQuoteVersion=" + exception.getCurrentQuoteVersion())
                : List.of("QUOTE_VERSION_CONFLICT");
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(HttpStatus.CONFLICT.getReasonPhrase(), exception.getMessage(), details));
    }

    /**
     * 处理业务状态冲突：所有 IllegalStateException 都表示"当前业务状态不允许此操作"
     * （例如：验证码冷却期重复发送、验证码已过期/已被核销、优惠券核销失败、支付金额不匹配、支付状态核对中暂不可取消等）。
     * 根据错误消息语义细化为更合适的 HTTP 状态码，保留原始错误消息供前端展示。
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalState(IllegalStateException exception) {
        log.warn("Business state conflict: {}", exception.getMessage());
        String message = exception.getMessage();
        HttpStatus status = HttpStatus.CONFLICT;
        if (message != null) {
            // 限流类错误：包含"秒后重试"或"尝试次数过多"
            if (message.contains("秒后重试") || message.contains("尝试次数过多")) {
                status = HttpStatus.TOO_MANY_REQUESTS;
            }
        }
        return ResponseEntity.status(status)
                .body(new ApiErrorResponse(status.getReasonPhrase(), message, List.of()));
    }

    @ExceptionHandler(LazyInitializationException.class)
    public ResponseEntity<ApiErrorResponse> handleLazyInit(LazyInitializationException exception) {
        log.error("LazyInitializationException — a lazy collection was accessed outside of a transaction", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse("Internal Server Error", "Data could not be loaded. Please retry.", List.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<String> details = exception.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .toList();
        return ResponseEntity.badRequest().body(new ApiErrorResponse("Validation Failed", "Request validation failed.", details));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraint(ConstraintViolationException exception) {
        List<String> details = exception.getConstraintViolations().stream()
                .map(violation -> violation.getMessage())
                .toList();
        return ResponseEntity.badRequest().body(new ApiErrorResponse("Validation Failed", "Request validation failed.", details));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
        log.error("Unexpected error occurred", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse("Internal Server Error", "An unexpected error occurred.", List.of()));
    }
}
