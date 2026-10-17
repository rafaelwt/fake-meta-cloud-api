### Respuesta webhook de WhatsApp - Status Updates

Los webhooks de status te permiten saber el estado de los mensajes enviados (si fueron enviados, entregados, leídos o fallaron).

---

#### Status: SENT (Enviado)
El mensaje fue enviado exitosamente desde tu cuenta de WhatsApp Business.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "PHONE_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.HBgLNTkxNzgwODU1NzYVAgARGBI5QTA2RjE2NTkxMkE4OTNFMTUA",
                "status": "sent",
                "timestamp": "1748718745",
                "recipient_id": "59178085576",
                "pricing": {
                  "billable": true,
                  "pricing_model": "PMP",
                  "type": "regular",
                  "category": "marketing"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

#### Status: DELIVERED (Entregado)
El mensaje fue entregado al dispositivo del destinatario.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "PHONE_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.HBgLNTkxNzgwODU1NzYVAgARGBI5QTA2RjE2NTkxMkE4OTNFMTUA",
                "status": "delivered",
                "timestamp": "1748718750",
                "recipient_id": "59178085576",
                "pricing": {
                  "billable": true,
                  "pricing_model": "PMP",
                  "type": "regular",
                  "category": "marketing"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

#### Status: READ (Leído)
El destinatario leyó el mensaje (requiere que el destinatario tenga las confirmaciones de lectura activadas).

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "PHONE_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.HBgLNTkxNzgwODU1NzYVAgARGBI5QTA2RjE2NTkxMkE4OTNFMTUA",
                "status": "read",
                "timestamp": "1748718755",
                "recipient_id": "59178085576"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

#### Status: FAILED (Error)
El mensaje no pudo ser entregado. Incluye información sobre el error.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "PHONE_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.HBgLNTkxNzgwODU1NzYVAgARGBI5QTA2RjE2NTkxMkE4OTNFMTUA",
                "status": "failed",
                "timestamp": "1748718760",
                "recipient_id": "59178085576",
                "errors": [
                  {
                    "code": 131047,
                    "title": "Re-engagement message",
                    "message": "Re-engagement message was not delivered because the destination phone number has not communicated with your WhatsApp Business account in the last 24 hours",
                    "error_data": {
                      "details": "Message failed to send because more than 24 hours have passed since the customer last replied to this number"
                    }
                  }
                ]
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

### Códigos de error comunes

| Código | Título | Descripción |
|--------|--------|-------------|
| 131047 | Re-engagement message | Han pasado más de 24 horas desde que el cliente respondió por última vez |
| 131045 | Spam rate limit hit | Límite de spam alcanzado |
| 131026 | Message undeliverable | Mensaje no entregable (número inválido o bloqueado) |
| 131031 | Recipient phone number not available | Número de teléfono del destinatario no disponible |
| 131051 | Unsupported message type | Tipo de mensaje no soportado |
| 133016 | User's number is part of an experiment | El número del usuario forma parte de un experimento |

---

### Campos principales del objeto status

- **id**: ID del mensaje (wamid)
- **status**: Estado del mensaje (`sent`, `delivered`, `read`, `failed`)
- **timestamp**: Marca de tiempo Unix del evento
- **recipient_id**: Número de WhatsApp del destinatario
- **conversation**: Omitido desde v24.0 (solo aparece en conversaciones de free entry point)
- **pricing**: Información de facturación (solo en `sent` y `delivered`)
  - **billable**: Si el mensaje es facturable
  - **pricing_model**: Modelo de precios (`PMP` = Per-Message Pricing; `CBP` solo antes del 1/7/2025)
  - **type**: `regular`, `free_customer_service` o `free_entry_point`
  - **category**: `marketing`, `utility`, `authentication`, `authentication-international`, `marketing_lite`, `referral_conversion` o `service`
- **errors**: Array de errores (solo en status `failed`)
  - **code**: Código de error
  - **title**: Título del error
  - **message**: Mensaje descriptivo del error
  - **error_data**: Datos adicionales del error
