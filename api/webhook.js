export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { challenge, event } = req.body;

  if (challenge) {
    return res.status(200).json({ challenge });
  }

  if (event?.message?.content) {
    const content = JSON.parse(event.message.content).text;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${process.env.OPENAI_API_KEY}\`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content }],
      }),
    });

    const gptData = await gptRes.json();
    const answer = gptData.choices?.[0]?.message?.content || "Bot gặp lỗi khi trả lời.";

    const tokenRes = await fetch(
      "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: process.env.APP_ID,
          app_secret: process.env.APP_SECRET,
        }),
      }
    );

    const tokenJson = await tokenRes.json();
    const token = tokenJson.tenant_access_token;

    await fetch("https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${token}\`,
      },
      body: JSON.stringify({
        receive_id: event.message.chat_id,
        content: JSON.stringify({ text: answer }),
        msg_type: "text",
      }),
    });
  }

  return res.status(200).send("ok");
}
