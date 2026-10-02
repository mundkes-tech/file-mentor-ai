import mongoose, { Schema } from "mongoose";

export interface ICandidateQuote {
  text: string;
}

export interface IChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "sending" | "streaming" | "complete" | "stopped" | "error";
  candidateQuotes?: ICandidateQuote[];
  citations?: any[];
  retrievalMetadata?: any;
  timestamp: Date;
  error?: string;
}

export interface IChatSession {
  _id: string;
  documentId: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const CandidateQuoteSchema = new Schema<ICandidateQuote>(
  {
    text: { type: String, required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["sending", "streaming", "complete", "stopped", "error"],
      default: "complete",
    },
    candidateQuotes: { type: [CandidateQuoteSchema], default: [] },
    citations: { type: [Schema.Types.Mixed], default: [] },
    retrievalMetadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    error: { type: String },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    _id: { type: String, required: true },
    documentId: { type: String, required: true, index: true },
    messages: { type: [ChatMessageSchema], default: [] },
  },
  {
    timestamps: true,
    _id: false,
  }
);

if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as any).ChatSession;
}

export const ChatSessionModel =
  (mongoose.models.ChatSession as mongoose.Model<IChatSession>) ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
