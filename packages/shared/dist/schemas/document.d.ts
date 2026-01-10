import { z } from 'zod';
export declare const DocumentSourceSchema: z.ZodEnum<["BIP", "RADA_SYSTEM", "MANUAL"]>;
export declare const DocumentSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodEnum<["BIP", "RADA_SYSTEM", "MANUAL"]>;
    url: z.ZodOptional<z.ZodString>;
    hash: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["PDF", "DOCX", "SCAN", "OTHER"]>>;
    createdAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    source: "BIP" | "RADA_SYSTEM" | "MANUAL";
    type?: "PDF" | "DOCX" | "SCAN" | "OTHER" | undefined;
    createdAt?: string | undefined;
    url?: string | undefined;
    hash?: string | undefined;
}, {
    id: string;
    source: "BIP" | "RADA_SYSTEM" | "MANUAL";
    type?: "PDF" | "DOCX" | "SCAN" | "OTHER" | undefined;
    createdAt?: string | undefined;
    url?: string | undefined;
    hash?: string | undefined;
}>;
export type Document = z.infer<typeof DocumentSchema>;
//# sourceMappingURL=document.d.ts.map