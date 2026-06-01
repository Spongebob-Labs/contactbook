import { ConnectionStatus, WhatsappFlowState } from "@prisma/client";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";

const CONN_ID = "11111111-1111-4111-8111-111111111111";

describe("WhatsappWebhookService", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    whatsappSession: { findFirst: jest.fn(), updateMany: jest.fn() },
    connection: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    contactCard: { count: jest.fn() },
  };
  const twilio = { sendWhatsApp: jest.fn() };
  const connectionShare = {
    beginRecipientCardSelection: jest.fn(),
    shareCard: jest.fn(),
    beginRequesterCardSelection: jest.fn(),
    sendCompletionMessages: jest.fn(),
  };
  const svc = new WhatsappWebhookService(
    prisma as never,
    twilio as never,
    connectionShare as never,
  );

  const user = {
    id: "u1",
    firstName: "Jane",
    lastName: "Doe",
    countryCode: "+1",
    phone: "2025551234",
  };
  const fromE164 = "whatsapp:+12025551234";

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
  });

  it("starts card selection on accept", async () => {
    prisma.connection.findFirst.mockResolvedValue({
      id: CONN_ID,
      receiverId: user.id,
      status: ConnectionStatus.PENDING,
    });
    prisma.contactCard.count.mockResolvedValue(2);
    connectionShare.beginRecipientCardSelection.mockResolvedValue([]);

    await svc.handleInboundMessage(fromE164, `ACCEPT-${CONN_ID}`);

    expect(connectionShare.beginRecipientCardSelection).toHaveBeenCalledWith(
      CONN_ID,
      user.id,
    );
  });

  it("notifies requester on decline", async () => {
    prisma.connection.findFirst.mockResolvedValue({
      id: CONN_ID,
      receiverId: user.id,
      status: ConnectionStatus.PENDING,
      requester: {
        id: "req-1",
        firstName: "Bob",
        lastName: "Smith",
        countryCode: "+1",
        phone: "2025559999",
      },
    });

    await svc.handleInboundMessage(fromE164, `DECLINE-${CONN_ID}`);

    expect(prisma.connection.update).toHaveBeenCalledWith({
      where: { id: CONN_ID },
      data: { status: ConnectionStatus.DECLINED },
    });
    expect(twilio.sendWhatsApp).toHaveBeenCalledTimes(2);
  });

  it("routes card selection by active session", async () => {
    prisma.whatsappSession.findFirst.mockResolvedValue({
      connectionId: CONN_ID,
      state: WhatsappFlowState.AWAITING_RECIPIENT_CARD_SELECTION,
      metadata: {
        cardOptions: [{ id: "card-1", name: "Personal", index: 1 }],
      },
    });
    connectionShare.shareCard.mockResolvedValue({
      completed: false,
      sharedCard: { name: "Personal" },
    });
    prisma.connection.findUniqueOrThrow.mockResolvedValue({
      requesterId: "req-1",
    });

    await svc.handleInboundMessage(fromE164, "1");

    expect(connectionShare.shareCard).toHaveBeenCalledWith(
      CONN_ID,
      user.id,
      "card-1",
      "recipient",
    );
  });
});
