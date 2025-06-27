import os
import tempfile
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
import json
import datetime
import random
import pickle
import requests
from urllib.parse import quote
import re
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Set cache directories to writable locations
os.environ['TRANSFORMERS_CACHE'] = '/tmp/transformers_cache'
os.environ['HF_HOME'] = '/tmp/hf_cache'
os.environ['TORCH_HOME'] = '/tmp/torch_cache'

# Create cache directories
os.makedirs('/tmp/transformers_cache', exist_ok=True)
os.makedirs('/tmp/hf_cache', exist_ok=True)
os.makedirs('/tmp/torch_cache', exist_ok=True)

app = Flask(__name__)
CORS(app)

# Configuration
class Config:
    PORT = int(os.environ.get('PORT', 7860))
    DEBUG = False
    MODEL_NAME = os.environ.get('MODEL_NAME', 'distilgpt2')

# Initialize model variables
model = None
tokenizer = None

def load_model():
    """Load model with proper cache handling"""
    global model, tokenizer
    
    try:
        model_name = Config.MODEL_NAME
        print(f"Loading model: {model_name}")
        
        # Load with explicit cache directory
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir='/tmp/transformers_cache',
            local_files_only=False
        )
        
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            cache_dir='/tmp/transformers_cache',
            torch_dtype=torch.float32,  # Use float32 for better compatibility
            local_files_only=False
        )
        
        # Set padding token
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        print(f"Successfully loaded {model_name}")
        return True
        
    except Exception as e:
        print(f"Error loading model {model_name}: {e}")
        
        # Fallback to an even smaller model
        try:
            print("Trying fallback model: gpt2")
            tokenizer = AutoTokenizer.from_pretrained(
                'gpt2',
                cache_dir='/tmp/transformers_cache'
            )
            model = AutoModelForCausalLM.from_pretrained(
                'gpt2',
                cache_dir='/tmp/transformers_cache'
            )
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
            print("Fallback model loaded successfully")
            return True
        except Exception as e2:
            print(f"Fallback model also failed: {e2}")
            return False

# Your existing code continues here...
conversations = {}
active_session = None

# Simple in-memory storage for Hugging Face (no pickle files)
class SimpleMemory:
    def __init__(self):
        self.facts = {}
        self.conversation_history = []
    
    def add_fact(self, key, value):
        self.facts[key] = value
    
    def get_context(self, query):
        # Simple context matching
        context = []
        query_lower = query.lower()
        for key, value in self.facts.items():
            if any(word in value.lower() for word in query_lower.split()):
                context.append(value)
        return context[:3]
    
    def add_to_history(self, user_msg, bot_msg):
        self.conversation_history.append({
            'user': user_msg,
            'bot': bot_msg,
            'timestamp': datetime.datetime.now().isoformat()
        })
        # Keep only last 10 conversations
        if len(self.conversation_history) > 10:
            self.conversation_history = self.conversation_history[-10:]

bot_memory = SimpleMemory()

BOT_PERSONALITIES = {
    "professional": "You are a professional business assistant. Respond formally and helpfully.",
    "friendly": "You are a friendly and casual assistant. Be warm and approachable.",
    "technical": "You are a technical expert. Provide detailed and accurate information.",
    "creative": "You are a creative assistant. Be imaginative and inspiring."
}

def search_web(query, num_results=3):
    """Simple web search using DuckDuckGo API"""
    try:
        url = f"https://api.duckduckgo.com/?q={quote(query)}&format=json&no_html=1&skip_disambig=1"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        results = []
        
        if data.get('AbstractText'):
            results.append({
                'title': data.get('AbstractSource', 'DuckDuckGo'),
                'snippet': data.get('AbstractText'),
                'url': data.get('AbstractURL', '')
            })
        
        for topic in data.get('RelatedTopics', [])[:num_results]:
            if isinstance(topic, dict) and 'Text' in topic:
                results.append({
                    'title': topic.get('FirstURL', '').split('/')[-1].replace('_', ' ') if topic.get('FirstURL') else 'Related Info',
                    'snippet': topic.get('Text', ''),
                    'url': topic.get('FirstURL', '')
                })
        
        return results[:num_results]
        
    except Exception as e:
        print(f"Search error: {e}")
        return []

def should_search_web(user_input):
    """Determine if web search is needed"""
    search_triggers = [
        'search for', 'look up', 'find information about', 'what is',
        'who is', 'when did', 'where is', 'how to', 'latest news',
        'current', 'recent', 'today', 'news about', 'tell me about'
    ]
    
    return any(trigger in user_input.lower() for trigger in search_triggers)

def format_search_results(results):
    """Format search results for display"""
    if not results:
        return "I couldn't find any relevant information online."
    
    formatted = "Here's what I found:\n\n"
    for i, result in enumerate(results, 1):
        title = result.get('title', 'Unknown')
        snippet = result.get('snippet', 'No description available')
        
        formatted += f"{i}. **{title}**\n"
        if len(snippet) > 150:
            formatted += f"   {snippet[:150]}...\n\n"
        else:
            formatted += f"   {snippet}\n\n"
    
    return formatted

def generate_response(prompt, personality='friendly'):
    """Generate response using the loaded model"""
    global model, tokenizer
    
    if model is None or tokenizer is None:
        return "I'm sorry, but I'm having trouble with my language model. Please try a web search query instead."
    
    try:
        # Simple personality prompt
        system_prompt = BOT_PERSONALITIES.get(personality, BOT_PERSONALITIES['friendly'])
        full_prompt = f"{system_prompt}\n\nHuman: {prompt}\nAssistant:"
        
        # Tokenize input
        inputs = tokenizer(
            full_prompt,
            return_tensors="pt",
            max_length=256,  # Reduced for better performance
            truncation=True,
            padding=True
        )
        
        # Generate response
        with torch.no_grad():
            outputs = model.generate(
                inputs['input_ids'],
                attention_mask=inputs['attention_mask'],
                max_new_tokens=50,  # Shorter responses for faster generation
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
                repetition_penalty=1.1
            )
        
        # Decode response
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Clean response
        if "Assistant:" in response:
            response = response.split("Assistant:")[-1].strip()
        
        # Remove the original prompt if it appears
        if full_prompt in response:
            response = response.replace(full_prompt, "").strip()
        
        # Ensure response is not empty
        if not response or len(response.strip()) < 5:
            response = "I'd be happy to help! Could you please provide more details about what you're looking for?"
        
        return response
        
    except Exception as e:
        print(f"Error generating response: {e}")
        return "I apologize, but I'm having trouble generating a response right now. Please try again."

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chatbot', methods=['POST'])
def handle_prompt():
    global active_session
    
    try:
        data = request.get_json()
        input_text = data['prompt']
        personality = data.get('personality', 'friendly')
        
        if not active_session:
            active_session = str(datetime.datetime.now().timestamp())
            conversations[active_session] = []
        
        # Check if web search is needed
        search_results = []
        web_search_used = False
        
        if should_search_web(input_text):
            search_results = search_web(input_text)
            web_search_used = True
            if search_results:
                response = format_search_results(search_results)
            else:
                response = generate_response(input_text, personality)
        else:
            response = generate_response(input_text, personality)
        
        # Store in memory
        bot_memory.add_to_history(input_text, response)
        
        # Store conversation
        conversations[active_session].append({
            'user': input_text,
            'bot': response,
            'timestamp': datetime.datetime.now().isoformat(),
            'personality': personality,
            'web_search_used': web_search_used
        })
        
        return jsonify({
            'response': response,
            'session_id': active_session,
            'web_search_used': web_search_used
        })
        
    except Exception as e:
        print(f"Error in handle_prompt: {e}")
        return jsonify({
            'response': 'I apologize, but I encountered an error. Please try again.',
            'session_id': active_session or 'error',
            'web_search_used': False
        }), 500

@app.route('/new-session', methods=['POST'])
def new_session():
    global active_session
    active_session = str(datetime.datetime.now().timestamp())
    conversations[active_session] = []
    return jsonify({'status': 'New session started'})

@app.route('/export-chat', methods=['GET'])
def export_chat():
    if active_session and active_session in conversations:
        return jsonify(conversations[active_session])
    return jsonify([])

# Initialize model when the app starts
print("Initializing chatbot...")
model_loaded = load_model()

if not model_loaded:
    print("Warning: Model failed to load. Web search will still work.")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.DEBUG)