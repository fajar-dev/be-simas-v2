export class AiSerializer {
    static decodeResult(data: { type: string; content: string }) {
        return {
            type: data.type,
            content: data.content,
        }
    }
}
