import mongoose, { Schema, Model, models } from "mongoose";

export interface INote {
  title?: string;           // optional note title
  content: string;          // TipTap HTML
  milestone?: string;       // if attached to a roadmap milestone
  userId: string;           // required – link to logged in user or guest
  createdAt?: Date;
  updatedAt?: Date;
}

const NoteSchema = new Schema<INote>(
  {
    title: { type: String },
    content: { type: String, required: true },
    milestone: { type: String },
    userId: { type: String, required: true }, // make user mandatory
  },
  { timestamps: true }
);

const Note: Model<INote> =
  (models.Note as Model<INote>) ||
  mongoose.model<INote>("Note", NoteSchema);

export default Note;
