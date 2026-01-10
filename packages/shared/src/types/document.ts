import { z } from "zod";

// Enums
export const DocumentStatus = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const DocumentType = z.enum([
  "resolution",
  "protocol",
  "report",
  "project",
  "announcement",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentType>;

export const AnalysisType = z.enum([
  "summary",
  "key_points",
  "risk_scan",
  "legal_check",
]);
export type AnalysisType = z.infer<typeof AnalysisType>;

export const RelationType = z.enum([
  "amends",
  "repeals",
  "implements",
  "references",
]);
export type RelationType = z.infer<typeof RelationType>;

export const JobType = z.enum([
  "extraction",
  "analysis",
  "embedding",
  "relation_detection",
]);
export type JobType = z.infer<typeof JobType>;

export const JobStatus = z.enum(["pending", "running", "completed", "failed"]);
export type JobStatus = z.infer<typeof JobStatus>;

// Document Schema
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  file_hash: z.string().length(64),
  source_url: z.string().url().nullable(),
  filename: z.string().max(500),
  file_path: z.string(),
  file_size_bytes: z.number().int().positive(),
  mime_type: z.string().max(100),
  status: DocumentStatus,

  // Metadane
  title: z.string().nullable(),
  document_number: z.string().max(100).nullable(),
  document_date: z.string().nullable(), // ISO date string
  author: z.string().max(255).nullable(),
  department: z.string().max(255).nullable(),
  document_type: DocumentType.nullable(),
  tags: z.array(z.string()).nullable(),

  // Ekstrakcja
  extracted_text: z.string().nullable(),
  extraction_quality_score: z.number().min(0).max(1).nullable(),
  extraction_method: z.string().max(50).nullable(),

  // Timestampy
  created_at: z.string(), // ISO datetime
  updated_at: z.string(),
  processed_at: z.string().nullable(),
});

export type Document = z.infer<typeof DocumentSchema>;

// Create Document Input
export const CreateDocumentSchema = DocumentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  processed_at: true,
}).partial({
  status: true,
  title: true,
  document_number: true,
  document_date: true,
  author: true,
  department: true,
  document_type: true,
  tags: true,
  extracted_text: true,
  extraction_quality_score: true,
  extraction_method: true,
  source_url: true,
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

// Update Document Input
export const UpdateDocumentSchema = CreateDocumentSchema.partial();
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

// Chunk Schema
export const ChunkSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  chunk_index: z.number().int().nonnegative(),
  content: z.string(),
  token_count: z.number().int().positive().nullable(),
  embedding: z.array(z.number()).length(1536).nullable(),
  page_number: z.number().int().positive().nullable(),
  section_title: z.string().nullable(),
  created_at: z.string(),
});

export type Chunk = z.infer<typeof ChunkSchema>;

// Analysis Schema
export const AnalysisSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  analysis_type: AnalysisType,
  result: z.record(z.unknown()), // JSONB
  confidence_score: z.number().min(0).max(1).nullable(),
  model_used: z.string().max(100).nullable(),
  prompt_version: z.string().max(20).nullable(),
  tokens_used: z.number().int().positive().nullable(),
  created_at: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

// Document Relation Schema
export const DocumentRelationSchema = z.object({
  id: z.string().uuid(),
  source_document_id: z.string().uuid(),
  target_document_id: z.string().uuid(),
  relation_type: RelationType,
  description: z.string().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  created_at: z.string(),
});

export type DocumentRelation = z.infer<typeof DocumentRelationSchema>;

// Processing Job Schema
export const ProcessingJobSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  job_type: JobType,
  status: JobStatus,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_message: z.string().nullable(),
  retry_count: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProcessingJob = z.infer<typeof ProcessingJobSchema>;

// API Response Types
export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});

export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;

export const DocumentDetailResponseSchema = DocumentSchema.extend({
  chunks: z.array(ChunkSchema).optional(),
  analyses: z.array(AnalysisSchema).optional(),
  relations: z.array(DocumentRelationSchema).optional(),
});

export type DocumentDetailResponse = z.infer<
  typeof DocumentDetailResponseSchema
>;

// Search Query
export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// Search Result
export const SearchResultSchema = z.object({
  chunk_id: z.string().uuid(),
  document_id: z.string().uuid(),
  document_title: z.string().nullable(),
  content: z.string(),
  similarity: z.number().min(0).max(1),
  page_number: z.number().int().positive().nullable(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
