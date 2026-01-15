import "dotenv/config";
import { Queue } from "bullmq";
import { type VisionJobData, type VisionJobResult } from "./jobs/vision.js";
export declare const documentQueue: Queue<any, any, string, any, any, string>;
export declare const userQueue: Queue<any, any, string, any, any, string>;
export declare const visionQueue: Queue<VisionJobData, VisionJobResult, string, VisionJobData, VisionJobResult, string>;
//# sourceMappingURL=index.d.ts.map