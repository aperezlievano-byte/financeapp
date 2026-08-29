// El puerto. Cero referencias a un proveedor especifico -- WhatsApp implementa
// esta misma forma despues sin tocar el nucleo. channel y sender son cadenas
// a proposito, no un enum: agregar un proveedor no debe requerir migracion.

export type Attachment = {
  kind: "photo" | "document";
  providerFileId: string;
  mimeType?: string;
};

export type NormalizedMessage = {
  channel: string;
  sender: string;
  text?: string;
  attachments: Attachment[];
  timestamp: Date;
  messageId: string;
};

export type IngestChannel = {
  readonly name: string;
  verifyRequest(request: Request): Promise<boolean>;
  normalize(request: Request): Promise<NormalizedMessage | null>;
  isAllowedSender(sender: string): boolean;
  reply(sender: string, text: string): Promise<void>;
  fetchAttachment(
    a: Attachment,
  ): Promise<{ bytes: Uint8Array; mimeType: string }>;
};
