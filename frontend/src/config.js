let CONFIG = null;

export async function loadConfig() {
    const res = await fetch("config.json");
    CONFIG = await res.json();
}

export function getConfig() {
    return CONFIG;
}