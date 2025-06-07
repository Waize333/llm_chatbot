# ChatBot Application

This is a Flask-based chatbot application that uses the `facebook/blenderbot-400M-distill` model from Hugging Face's Transformers library to generate conversational responses.

## Features

- **Conversational AI**: Uses a pre-trained BlenderBot model for generating responses.
- **Flask Framework**: Provides a lightweight web server for hosting the chatbot.
- **CORS Support**: Allows cross-origin requests for integration with front-end applications.
- **Conversation History**: Maintains a history of the conversation for context-aware responses.

---

## Requirements

To run this project, you need the following:

- Python 3.8 or higher
- Required Python libraries:
  - `flask`
  - `flask-cors`
  - `transformers`
  - `torch`

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/chatbot-application.git
   cd chatbot-application
   ```
