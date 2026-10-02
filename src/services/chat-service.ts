import { ChatMessage } from "@/types";
import { ChatSessionModel, IChatMessage } from "@/models/ChatSession";
import { connectToDatabase } from "@/lib/mongodb";

export function getSessionKey(documentIds: string | string[]): string {
  if (Array.isArray(documentIds)) {
    const clean = Array.from(new Set(documentIds.map((id) => id.trim()))).filter(Boolean).sort();
    return clean.join("+");
  }
  return (documentIds || "").trim();
}

function mapDbMessageToChatMessage(documentId: string, msg: any): ChatMessage {
  return {
    id: msg.id,
    documentId,
    documentIds: msg.documentIds || (documentId.includes("+") ? documentId.split("+") : undefined),
    role: msg.role,
    content: msg.content || "",
    timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
    status: msg.status || "complete",
    candidateQuotes: msg.candidateQuotes || [],
    citations: msg.citations || [],
    retrievalMetadata: msg.retrievalMetadata,
    error: msg.error,
  };
}

export const chatService = {
  /**
   * Retrieves chat message history for single or multiple documents from MongoDB.
   */
  async getMessages(documentIds: string | string[]): Promise<ChatMessage[]> {
    await connectToDatabase();
    const sessionKey = getSessionKey(documentIds);
    if (!sessionKey) return [];

    const session = await ChatSessionModel.findOne({ documentId: sessionKey }).lean();
    if (!session || !session.messages) {
      return [];
    }
    return session.messages.map((m) => mapDbMessageToChatMessage(sessionKey, m));
  },

  /**
   * Backward-compatible alias for single document history.
   */
  async getMessagesForDocument(documentId: string): Promise<ChatMessage[]> {
    return this.getMessages(documentId);
  },

  /**
   * Appends a message to the chat history in MongoDB.
   */
  async saveMessage(documentIds: string | string[], message: ChatMessage): Promise<void> {
    await connectToDatabase();
    const sessionKey = getSessionKey(documentIds);
    if (!sessionKey) return;

    const sessionId = `session_${sessionKey}`;
    const dbMsg: IChatMessage = {
      id: message.id,
      role: message.role,
      content: message.content,
      status: message.status,
      candidateQuotes: message.candidateQuotes || [],
      citations: message.citations || [],
      retrievalMetadata: message.retrievalMetadata,
      timestamp: new Date(message.timestamp || Date.now()),
      error: message.error,
    };

    await ChatSessionModel.findOneAndUpdate(
      { documentId: sessionKey },
      {
        $setOnInsert: { _id: sessionId, documentId: sessionKey },
        $push: { messages: dbMsg },
      },
      { upsert: true, new: true }
    );
  },

  /**
   * Updates an existing message in MongoDB (e.g. streaming update, stopped status).
   */
  async updateMessage(
    documentIds: string | string[],
    messageId: string,
    updates: {
      content?: string;
      status?: "sending" | "streaming" | "complete" | "stopped" | "error";
      candidateQuotes?: { text: string }[];
      citations?: any[];
      retrievalMetadata?: any;
      error?: string;
    }
  ): Promise<void> {
    await connectToDatabase();
    const sessionKey = getSessionKey(documentIds);
    if (!sessionKey) return;

    const updateFields: Record<string, any> = {};
    if (updates.content !== undefined) {
      updateFields["messages.$.content"] = updates.content;
    }
    if (updates.status !== undefined) {
      updateFields["messages.$.status"] = updates.status;
    }
    if (updates.candidateQuotes !== undefined) {
      updateFields["messages.$.candidateQuotes"] = updates.candidateQuotes;
    }
    if (updates.citations !== undefined) {
      updateFields["messages.$.citations"] = updates.citations;
    }
    if (updates.retrievalMetadata !== undefined) {
      updateFields["messages.$.retrievalMetadata"] = updates.retrievalMetadata;
    }
    if (updates.error !== undefined) {
      updateFields["messages.$.error"] = updates.error;
    }

    await ChatSessionModel.updateOne(
      { documentId: sessionKey, "messages.id": messageId },
      { $set: updateFields }
    );
  },

  /**
   * Clears all messages for a document or multi-document session in MongoDB.
   */
  async clearDocumentChat(documentIds: string | string[]): Promise<void> {
    await connectToDatabase();
    const sessionKey = getSessionKey(documentIds);
    if (!sessionKey) return;
    await ChatSessionModel.deleteOne({ documentId: sessionKey });
  },
};
