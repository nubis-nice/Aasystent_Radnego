import { Job } from "bullmq";
interface RelationsJobData {
    sourceDocumentId: string;
    sourceText: string;
    targetDocuments: Array<{
        id: string;
        text: string;
    }>;
}
export declare function processRelations(job: Job<RelationsJobData>): Promise<{
    sourceDocumentId: string;
    relationsFound: number;
    relations: {
        targetDocumentId: string;
        relationType: string;
        description: string;
        confidence: number;
    }[];
}>;
export {};
//# sourceMappingURL=relations.d.ts.map