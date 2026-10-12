from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import llm, youtube

router = APIRouter()


# -------------------- Request Models --------------------

class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    model: str | None = None

    # Study assistant options
    action: Literal[
        "answer",
        "explain",
        "summarize",
        "quiz",
        "flashcards",
        "refine",
        "revision",
        "recommend",
    ] = "answer"

    scope: Literal[
        "current_page",
        "project",
        "selected",
    ] = "current_page"

    notes: str = ""
    project_notes: str = ""
    selected_text: str = ""

    difficulty: Literal["easy", "medium", "hard"] = "medium"

    # Supply previous quiz results for adaptive learning.
    quiz_history: list[dict] = Field(
        default_factory=list,
        max_length=50,
    )


class ChatResponse(BaseModel):
    reply: str


# -------------------- AI Instructions --------------------

SYSTEM_PROMPT = """
You are an AI Study Assistant for an interactive learning canvas.

GENERAL RULES:
1. Base answers primarily on the student's supplied notes.
2. Never pretend missing information exists in the notes.
3. If the notes are insufficient, explicitly say so.
4. Clearly label any additional general knowledge.
5. Use clear, student-friendly language and useful headings.
6. Never claim to have saved or modified the student's notes.
7. Refinements must be proposed for review and approval.
8. Do not invent quiz history or claim to remember past performance.

SUPPORTED ACTIONS:

answer:
Answer questions using the supplied notes.

explain:
Explain concepts simply and give examples where useful.

summarize:
Create a concise, structured summary of the supplied notes.

quiz:
Generate a mixed quiz containing multiple-choice,
true/false, and short-answer questions.
For MCQs, provide four options and indicate the correct answer
in a separate answer key.
Include explanations for the answers.

flashcards:
Generate revision flashcards in Question / Answer format.

refine:
Correct grammar, simplify explanations, organize information,
improve answers, or prepare exam-oriented notes.
Clearly label the proposed revised content.
Never replace the original notes automatically.

revision:
Generate a project-wide revision sheet containing key concepts,
definitions, important points, and likely exam questions.

recommend:
Use supplied quiz history and notes to identify weak topics
and recommend what the student should revise next.

YOUTUBE:
If the student asks for videos, a YouTube link or a tutorial, never write a URL yourself.
Instead add one line per suggestion (at most 3) in exactly this form:
[[YOUTUBE: short search query]]
The application turns each line into a working YouTube link.

QUIZ DIFFICULTY:
easy = basic definitions and recall.
medium = understanding and application.
hard = deeper reasoning and application.

ADAPTIVE LEARNING:
Use the provided quiz history when available to recommend
appropriate difficulty and topics needing practice.
Do not claim that future quiz difficulty has been changed
unless the application actually implements that behavior.

GROUNDING:
Generate note-specific content only when relevant notes exist.
If the requested notes are empty, ask the student to add notes.
For project-wide requests, use the complete project context supplied.
For selected-content requests, focus on the selected text.
"""


# -------------------- Chat Endpoint --------------------

@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        # Select the correct context for this request.
        if req.scope == "current_page":
            context = req.notes

        elif req.scope == "project":
            context = req.project_notes

        else:
            context = req.selected_text

        # Avoid sending excessively large prompts.
        context = context[:30000]

        # Reject note-specific requests if there are no notes.
        note_actions = {
            "answer",
            "explain",
            "summarize",
            "quiz",
            "flashcards",
            "refine",
            "revision",
            "recommend",
        }

        if req.action in note_actions and not context.strip():
            raise HTTPException(
                status_code=400,
                detail=(
                    "No notes were provided for the selected scope. "
                    "Add notes or select content and try again."
                ),
            )

        # Limit the history included in the prompt.
        quiz_history = req.quiz_history[-20:]

        context_prompt = f"""
STUDY ASSISTANT REQUEST

Action: {req.action}
Context scope: {req.scope}
Quiz difficulty: {req.difficulty}

STUDENT NOTES:
{context}

SELECTED TEXT:
{req.selected_text[:10000] if req.scope != "selected" else context}

PREVIOUS QUIZ PERFORMANCE:
{quiz_history}

Follow the system instructions and the user's latest request.
"""

        # Preserve conversation history and existing LLM integration.
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": context_prompt},
            *[message.model_dump() for message in req.messages],
        ]

        reply = llm.chat(
            messages,
            model=req.model,
        )

        # Turn [[YOUTUBE: query]] markers into working YouTube search links.
        reply = youtube.replace_markers(reply)

        return {"reply": reply}

    except HTTPException:
        raise

    except llm.LLMError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        # Log the actual exception in the backend terminal.
        import logging

        logging.exception("Study assistant request failed")

        raise HTTPException(
            status_code=500,
            detail="The AI study assistant encountered an error.",
        ) from exc