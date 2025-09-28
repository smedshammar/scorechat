const OpenAI = require('openai');
require('dotenv').config();

async function testOpenAI() {
  console.log('Testing OpenAI connection...');
  console.log('API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 10000,
  });

  try {
    console.log('Making request to OpenAI...');
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello' }],
      model: 'gpt-3.5-turbo',
      max_tokens: 10,
    });

    console.log('Success! Response:', completion.choices[0].message.content);
  } catch (error) {
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      cause: error?.cause?.code,
      errno: error?.cause?.errno,
    });
  }
}

testOpenAI();