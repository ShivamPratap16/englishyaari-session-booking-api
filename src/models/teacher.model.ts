import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const teacherSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    specialization: { type: String, required: true, trim: true },
    // Years of teaching experience.
    experience: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export type Teacher = InferSchemaType<typeof teacherSchema>;
export type TeacherDocument = HydratedDocument<Teacher>;

export const TeacherModel = model('Teacher', teacherSchema);
