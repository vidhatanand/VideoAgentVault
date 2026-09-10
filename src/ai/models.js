export const MODELS=Object.freeze({
  asr:'@cf/openai/whisper-large-v3-turbo',
  vision:'@cf/google/gemma-4-26b-a4b-it',
  embed:'@cf/baai/bge-small-en-v1.5',
  image:'@cf/black-forest-labs/flux-1-schnell',
  speech:'@cf/deepgram/aura-2-en'
});
export const EMBEDDING_DIMENSIONS=384;
export function gemmaInput(prompt,imageUrl) {
  return {messages:[{role:'user',content:imageUrl?[{type:'text',text:prompt},{type:'image_url',image_url:{url:imageUrl}}]:prompt}],
    max_tokens:700,temperature:0.2,stream:false,chat_template_kwargs:{enable_thinking:false}};
}
export function speechInput(text) {return {text,speaker:'luna',encoding:'mp3'};}
