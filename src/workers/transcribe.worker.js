import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;

// Use the singleton pattern to enable lazy construction of the pipeline.
class PipelineSingelton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;
    console.log(`[Worker] Received message: ${type}`);

    if (type === 'load') {
        try {
            console.log('[Worker] Loading pipeline...');
            await PipelineSingelton.getInstance((x) => {
                // We also want to track model download progress
                self.postMessage({ type: 'download', data: x });
            });
            console.log('[Worker] Pipeline ready');
            self.postMessage({ type: 'ready' });
        } catch (err) {
            console.error('[Worker] Load error:', err);
            self.postMessage({ type: 'error', data: err.message });
        }
    } else if (type === 'run') {
        try {
            console.log('[Worker] Starting transcription run...', data);
            const transcriber = await PipelineSingelton.getInstance();
            console.log('[Worker] Transcriber instance ready');

            // Run transcription
            const output = await transcriber(data.audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: data.language || 'english',
                task: 'transcribe',
                return_timestamps: true,
                callback_function: (x) => {
                    // console.log('[Worker] progress', x);
                    // Sanitize progress object to avoid Proxy issues
                    const safeProgress = JSON.parse(JSON.stringify(x));
                    self.postMessage({ type: 'progress', data: safeProgress });
                }
            });

            console.log('[Worker] Transcription complete:', output);
            // Sanitize output object to avoid Proxy issues
            const safeOutput = JSON.parse(JSON.stringify(output));
            self.postMessage({ type: 'result', data: safeOutput });
        } catch (err) {
            console.error('[Worker] Run error:', err);
            self.postMessage({ type: 'error', data: err.message });
        }
    }
});
