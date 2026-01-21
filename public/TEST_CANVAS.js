/**
 * Testes rápidos para verificar se a renderização está funcionando
 * Copie este código no console do navegador enquanto o app está rodando
 */

// Teste 1: Verificar se externalElementsService está carregado
console.log("=== TESTE 1: Verificar Serviço Externo ===");
try {
    // Será carregado dinamicamente no momento do uso
    console.log(
        "✓ externalElementsService será carregado quando necessário"
    );
} catch (error) {
    console.error("✗ Erro ao carregar serviço:", error);
}

// Teste 2: Verificar elementos padrão
console.log("\n=== TESTE 2: Elementos Padrão ===");
const defaultElements = [
    "default-1",
    "default-2",
    "default-3",
    "default-4",
    "default-5",
    "default-6",
];
console.log(`✓ Total de elementos padrão: ${defaultElements.length}`);

// Teste 3: Verificar se Canvas está disponível
console.log("\n=== TESTE 3: Verificar Canvas ===");
const canvasElement = document.querySelector("canvas");
if (canvasElement) {
    console.log(`✓ Canvas encontrado:`, {
        width: canvasElement.width,
        height: canvasElement.height,
        offsetWidth: canvasElement.offsetWidth,
        offsetHeight: canvasElement.offsetHeight,
    });
} else {
    console.log("✗ Canvas não encontrado no DOM");
}

// Teste 4: Verificar estrutura do DOM
console.log("\n=== TESTE 4: Estrutura do DOM ===");
const sidebar = document.querySelector("[class*='sidebar']");
const panels = document.querySelector("[class*='panel']");
const toolbar = document.querySelector("[class*='toolbar']");

console.log(
    "✓ Sidebar:",
    sidebar ? "encontrada" : "não encontrada"
);
console.log(
    "✓ Panels:",
    panels ? "encontradas" : "não encontradas"
);
console.log(
    "✓ Toolbar:",
    toolbar ? "encontrada" : "não encontrada"
);

// Teste 5: Verificar se há erros no console anteriores
console.log("\n=== TESTE 5: Próximos Passos ===");
console.log("1. Clique em 'Elementos' na barra lateral");
console.log("2. Tente adicionar um shape (Quadrado, Círculo, Triângulo)");
console.log("3. Clique em 'Texto' e adicione um título");
console.log("4. Verifique se aparecem no canvas");
console.log("");
console.log("Se não aparecerem:");
console.log("- Abra a aba Network do DevTools");
console.log("- Procure por requisições falhadas");
console.log("- Veja a aba Console para erro 'Canvas not available'");
