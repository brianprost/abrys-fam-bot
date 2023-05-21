export function getImageFileName(url: string): string {
    return (
        url
            .split("/")
            .pop()
            ?.split(".")[0]
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") ?? ""
    );
}

export function botLog(message: string) {
    console.log(`🤖 ${message}`);
}