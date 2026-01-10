import { z } from 'zod';
export const DocumentSourceSchema = z.enum(['BIP', 'RADA_SYSTEM', 'MANUAL']);
export const DocumentSchema = z.object({
    id: z.string().min(1),
    source: DocumentSourceSchema,
    url: z.string().url().optional(),
    hash: z.string().min(8).optional(),
    type: z.enum(['PDF', 'DOCX', 'SCAN', 'OTHER']).optional(),
    createdAt: z.string().datetime().optional(),
});
//# sourceMappingURL=document.js.map