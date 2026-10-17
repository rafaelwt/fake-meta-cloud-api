# Enviar Template de WhatsApp

## Endpoint

```
POST https://graph.facebook.com/v26.0/<waba-id>/messages
```

**Nota:** Reemplaza `<waba-id>` con el ID de tu WhatsApp Business Account.

## Headers Requeridos

```
Content-Type: application/json
Authorization: Bearer <access-token>
```

## Request Body

### Ejemplo Completo

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+59179021784",
  "type": "template",
  "template": {
    "name": "recordatoriodepagos",
    "language": {
      "code": "es"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "cantidad",
            "text": "3"
          }
        ]
      }
    ]
  }
}
```

### Descripción de Campos

- **messaging_product**: Siempre debe ser `"whatsapp"`
- **recipient_type**: Tipo de destinatario (`"individual"` para usuarios individuales)
- **to**: Número de teléfono del destinatario en formato internacional (incluye el `+`)
- **type**: Tipo de mensaje, debe ser `"template"` para templates
- **template.name**: Nombre del template aprobado en Meta Business
- **template.language.code**: Código de idioma del template (ej: `"es"`, `"en"`)
- **template.components**: Array de componentes del template
  - **type**: Tipo de componente (`"body"`, `"header"`, `"button"`)
  - **parameters**: Array de parámetros para reemplazar variables en el template
    - **type**: Tipo de parámetro (`"text"`, `"image"`, `"document"`, etc.)
    - **parameter_name**: Nombre del parámetro definido en el template
    - **text**: Valor del parámetro (para tipo `"text"`)

## Response

### Respuesta Exitosa (200 OK)

```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "+59179021784",
      "wa_id": "59179021784"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI1RjA4RDc3NjhEOUJBMzdFODEA",
      "message_status": "accepted"
    }
  ]
}
```

### Descripción de la Respuesta

- **messaging_product**: Producto de mensajería utilizado
- **contacts**: Array con información del contacto
  - **input**: Número de teléfono proporcionado en la solicitud
  - **wa_id**: ID de WhatsApp del contacto (sin el `+`)
- **messages**: Array con información del mensaje enviado
  - **id**: ID único del mensaje (wamid)
  - **message_status**: Estado del mensaje (`"accepted"` indica que fue aceptado para envío)

### Posibles Estados del Mensaje

- `"accepted"`: Mensaje aceptado y en cola para envío
- `"delivered"`: Mensaje entregado al destinatario
- `"read"`: Mensaje leído por el destinatario
- `"failed"`: Error al enviar el mensaje

## Notas Importantes

1. El template debe estar previamente aprobado en Meta Business Manager
2. El número de teléfono debe incluir el código de país con el prefijo `+`
3. Los parámetros deben coincidir exactamente con los definidos en el template
4. El código de idioma debe coincidir con el idioma configurado en el template