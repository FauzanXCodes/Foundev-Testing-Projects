import ollama
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader

def generate_fib_content(subject, chapter, topic, subtopic):
    prompt = f"""
You are an educational expert. Create a short paragraph (100-150 words) on the topic: {subtopic},
related to Chapter: {chapter}, Subject: {subject}, for grade 6 students. Then:

1. Replace 8 important keywords with blanks (like _______) in the paragraph.
2. Create a word bank of those 8 words.
3. Create 8 FIB questions (1 per blank) based on the paragraph.
4. Output as a JSON object with: "paragraph", "word_bank" (list), "questions" (list), and "answers" (list).
Only return valid JSON.
    """
    response = ollama.chat(model="llama3", messages=[{"role": "user", "content": prompt}])
    import json
    return json.loads(response['message']['content'])

def generate_fib_pdf(content, filename, show_answers=False):
    doc = SimpleDocTemplate(filename, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    marker = ImageReader("static/marker.png")
    canvas_cb = lambda c, d: draw_markers(c, marker)

    story.append(Paragraph("<b>FILL IN THE BLANKS</b>", styles["Title"]))
    story.append(Spacer(1, 0.3 * cm))
    
    # Paragraph with blanks or answers
    text = content["paragraph"]
    if show_answers:
        for word in content["word_bank"]:
            text = text.replace("_______", word, 1)
    story.append(Paragraph(text, styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # Word Bank
    story.append(Paragraph("<b>Word Bank:</b> " + ", ".join(content["word_bank"]), styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # Questions
    for i, q in enumerate(content["questions"], 1):
        if show_answers:
            q += f" <b>Ans:</b> {content['answers'][i-1]}"
        story.append(Paragraph(q, styles["Normal"]))
        story.append(Spacer(1, 0.3 * cm))

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("Name: _____________________", styles["Normal"]))
    story.append(Paragraph("Date: _____________________", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Student Signature: _____________________", styles["Normal"]))
    story.append(Paragraph("Teacher Signature: _____________________", styles["Normal"]))

    doc.build(story, onFirstPage=canvas_cb)

def draw_markers(canvas, marker):
    for x, y in [(1*cm, 28*cm), (18*cm, 28*cm), (1*cm, 1*cm), (18*cm, 1*cm)]:
        canvas.drawImage(marker, x, y, width=0.5*cm, height=0.5*cm)
