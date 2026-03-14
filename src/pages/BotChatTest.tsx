import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

interface Message {
  role: "user" | "bot";
  text: string;
}

export const BotChatTest: React.FC = () => {
  const [phone, setPhone] = useState("5511999999999");
  const [contactName, setContactName] = useState("Contato Teste");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = inputMessage;
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await axios.post(process.env.BASE_URL + "/bot/chat", {
        phone,
        message: userMsg,
        contactName,
      });

      const botMessages =
        response.data.responses || response.data.messages || [];
      if (!Array.isArray(botMessages) || botMessages.length === 0) {
        setIsLoading(false);
        return;
      }

      let accumulatedDelay = 0;
      botMessages.forEach((m: any) => {
        const delay = typeof m.delay === "number" ? m.delay : 0;
        accumulatedDelay += delay;
        window.setTimeout(() => {
          setMessages((prev) => [...prev, { role: "bot", text: m.text }]);
        }, accumulatedDelay);
      });

      window.setTimeout(() => setIsLoading(false), accumulatedDelay);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Erro ao comunicar com o backend." },
      ]);
      setIsLoading(false);
    } finally {
      setInputMessage("");
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 bg-gray-50">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Teste do Bot</h2>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone do WhatsApp"
            className="border p-2 rounded w-1/3"
          />
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nome do Contato"
            className="border p-2 rounded w-1/3"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white border rounded p-4 mb-4 shadow-sm">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`p-3 rounded-lg max-w-[70%] whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"}`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-200 text-gray-800 p-3 rounded-lg">
              Digitando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite uma mensagem..."
          className="flex-1 border p-3 rounded"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-3 rounded font-medium disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};
