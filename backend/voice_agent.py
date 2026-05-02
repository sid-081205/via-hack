"""
via voice agent — fully scripted demo, LiveKit Inference only.

Flow:
  1. Caller says hi / hey                  →  via greets
  2. Caller asks for restaurant recs       →  via gives 3 + scam warning
  3. Caller says thanks                    →  via signs off with tomorrow's
                                              itinerary point and goodbye

If the caller goes off-script, falls through to the LLM with system prompt
context that Alex is in Alfama, central Lisbon May 9–11.

Stack: all routed through LiveKit Cloud Inference using your LiveKit API
key. No ElevenLabs, no Google plugin keys, no extra accounts.
"""

import json
import logging
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, JobContext, WorkerOptions, cli
from livekit.plugins import silero

load_dotenv()
logger = logging.getLogger("via-agent")


# ─────────────────────────────────────────────────────────────────────────
#  Hardcoded responses
# ─────────────────────────────────────────────────────────────────────────

GREETING = "Hey! I'm via, how can I help you today?"

RESTAURANT_RESPONSE = (
    "Of course! I can see from your itinerary you're staying in Alfama, central Lisbon — "
    "so a few good spots near you. "

    "First, Taberna da Rua das Flores in Chiado, about a ten-minute walk. "
    "Small place, no menu — they tell you what's good that day. Get there before seven or you'll wait. "

    "Second, Cervejaria Ramiro for seafood, especially the prawns. It's in Anjos, a short tuk-tuk ride. "
    "Cash-only and loud, but worth it. "

    "And third, if you want something quieter, Prado in Alfama itself, just five minutes from your stay. "
    "Natural wines and seasonal Portuguese plates. "

    "One quick heads-up though, since you're walking around central Lisbon — watch for a few common scams. "
    "Tuk-tuk drivers near Praça do Comércio sometimes quote one price and charge another, "
    "so agree on the fare before you get in. "
    "Also, in Alfama and around the 28 tram, pickpockets work in pairs — one bumps into you, the other lifts your wallet. "
    "Keep your phone in a front pocket on the tram. "

    "And anyone offering you sunglasses, drugs, or 'help' with your bag near tourist spots — just keep walking. "

    "Want me to book a table at any of these? Prado on Saturday night would fit your itinerary perfectly."
)

SIGNOFF_RESPONSE = (
    "You're so welcome, Alex. Have an amazing dinner tonight — "
    "and don't forget tomorrow morning at ten you've got the tram to Belém "
    "for the pastéis de Belém and the Jerónimos Monastery, "
    "then your two o'clock walking tour through Bairro Alto in the afternoon. "
    "It's going to be a great day. Call me if anything comes up — safe travels."
)


# ─────────────────────────────────────────────────────────────────────────
#  Pattern matching
# ─────────────────────────────────────────────────────────────────────────

def is_restaurant_ask(text: str) -> bool:
    """User asking for restaurant recommendations."""
    t = text.lower()
    food_words = ["restaurant", "restaurants", "eat", "dinner", "lunch", "food", "place to eat"]
    intent_words = ["recommend", "suggest", "good", "any", "where", "find", "nearby", "near"]
    return any(w in t for w in food_words) and any(w in t for w in intent_words)


def is_thanks(text: str) -> bool:
    """User saying thanks / goodbye to wrap up."""
    t = text.lower().strip().rstrip("!.?")
    thanks_phrases = [
        "thanks", "thank you", "thanks so much", "thanks a lot",
        "appreciate it", "amazing thanks", "thanks via", "perfect thanks",
        "great thanks", "ok thanks", "okay thanks", "cool thanks",
    ]
    return any(p in t for p in thanks_phrases)


# ─────────────────────────────────────────────────────────────────────────
#  Agent
# ─────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are via, a personal travel agent on the phone with Alex.
Alex is currently on the Lisbon trip you planned — staying in Alfama, central Lisbon, May 9–11.

Tomorrow (Saturday) Alex has:
- 10am: tram to Belém for pastéis de Belém and the Jerónimos Monastery
- 2pm: walking tour through Bairro Alto
- 8pm: dinner at Belcanto (already booked)

Speak in short sentences. Be warm, confident, conversational. This is voice, not text.
"""


class ViaVoiceAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=SYSTEM_PROMPT)


async def entrypoint(ctx: JobContext):
    metadata = json.loads(ctx.job.metadata or "{}")
    user_id = metadata.get("caller", "alex")
    logger.info(f"📞 Incoming call · user={user_id} · room={ctx.room.name}")

    await ctx.connect()

    # All three components routed through LiveKit Inference. No plugins
    # imported — just pass the model string and LiveKit Cloud handles it.
    session = AgentSession(
        vad=silero.VAD.load(),
        stt="assemblyai/universal-streaming:en",
        llm="google/gemini-2.5-flash",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    )

    # ─────────────────────────────────────────────────────────────────────
    #  Intercept user speech. If it matches a hardcoded scenario, speak
    #  the canned line and skip the LLM. Otherwise the LLM handles it.
    # ─────────────────────────────────────────────────────────────────────
    @session.on("user_input_transcribed")
    def _on_user_speech(transcript):
        if not transcript.is_final:
            return

        text = transcript.transcript
        logger.info(f"🎤 user said: {text!r}")

        if is_thanks(text):
            logger.info("✅ matched: signoff")
            session.say(SIGNOFF_RESPONSE, allow_interruptions=False)
            return

        if is_restaurant_ask(text):
            logger.info("✅ matched: restaurants")
            session.say(RESTAURANT_RESPONSE, allow_interruptions=True)
            return

    await session.start(room=ctx.room, agent=ViaVoiceAgent())

    # Open with greeting — bypasses LLM, instant audio
    await session.say(GREETING, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="via-agent",   # MUST match the dispatch rule JSON
        )
    )