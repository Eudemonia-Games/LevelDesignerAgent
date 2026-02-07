import { WebIO } from '@gltf-transform/core';
import { center, dedup, weld } from '@gltf-transform/functions';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
// @ts-ignore
import draco3d from 'draco3dgltf';

// Define options interface
export interface NormalizationOptions {
    center?: boolean;
    dedup?: boolean;
    weld?: boolean;
    compress?: boolean;
}

export class ModelConverter {
    private io: WebIO;

    constructor() {
        this.io = new WebIO();
        this.io.registerExtensions([KHRDracoMeshCompression]);
        this.io.registerDependencies({
            'draco3d.decoder': draco3d.createDecoderModule(),
            'draco3d.encoder': draco3d.createEncoderModule(),
        });
    }

    async normalizeGLB(buffer: Buffer, options: NormalizationOptions = { center: true, dedup: true, weld: true }): Promise<Buffer> {
        try {
            // Load
            const document = await this.io.readBinary(new Uint8Array(buffer));

            // Pipeline
            const processes: any[] = [];

            if (options.weld) processes.push(weld());
            if (options.dedup) processes.push(dedup());
            if (options.center) processes.push(center());

            // if (options.compress) {
            // Compression is heavy, maybe optional later
            // processes.push(quantize()); 
            // }

            await document.transform(...processes);

            // Write
            const outArray = await this.io.writeBinary(document);
            return Buffer.from(outArray);

        } catch (e: any) {
            console.error("Model normalization failed:", e);
            throw new Error(`Normalization failed: ${e.message}`);
        }
    }
}
