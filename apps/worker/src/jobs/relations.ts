import { Job } from "bullmq";
import {
  createOpenAIClient,
  detectDocumentRelations,
} from "@aasystent-radnego/shared";

interface RelationsJobData {
  sourceDocumentId: string;
  sourceText: string;
  targetDocuments: Array<{
    id: string;
    text: string;
  }>;
}

export async function processRelations(job: Job<RelationsJobData>) {
  const { sourceDocumentId, sourceText, targetDocuments } = job.data;

  job.log(
    `Detecting relations for document ${sourceDocumentId} with ${targetDocuments.length} targets`
  );
  await job.updateProgress(10);

  const openai = createOpenAIClient();
  const relations: Array<{
    targetDocumentId: string;
    relationType: string;
    description: string;
    confidence: number;
  }> = [];

  try {
    // Sprawdź relacje z każdym dokumentem docelowym
    for (let i = 0; i < targetDocuments.length; i++) {
      const target = targetDocuments[i];

      if (!target) continue;

      job.log(
        `Checking relation with document ${target.id} (${i + 1}/${
          targetDocuments.length
        })`
      );

      const relation = await detectDocumentRelations(
        openai,
        sourceText,
        target.text
      );

      if (relation.relationType && relation.confidence > 0.7) {
        relations.push({
          targetDocumentId: target.id,
          relationType: relation.relationType,
          description: relation.description,
          confidence: relation.confidence,
        });
      }

      await job.updateProgress(10 + ((i + 1) / targetDocuments.length) * 80);
    }

    job.log(`Found ${relations.length} relations`);

    // Zapisz relacje do bazy
    // TODO: Insert relations into database

    await job.updateProgress(100);

    return {
      sourceDocumentId,
      relationsFound: relations.length,
      relations,
    };
  } catch (error) {
    job.log(`Relations detection failed: ${error}`);
    throw error;
  }
}
