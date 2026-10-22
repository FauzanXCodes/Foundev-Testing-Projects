# app.py
import re
import os
import json
import pprint
import requests
import subprocess
import io
import uuid
from fpdf import FPDF
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session, flash
from markupsafe import Markup
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from collections import defaultdict
import csv
from datetime import datetime
import ollama
# These imports are assumed to exist from your original file structure
# from content_generate import fetch_textbooks_list, generate_educational_content, generate_content_with_ollama
# from config import TEXTBOOKS_API, DATA_DIR, FONTS_DIR, CONTENT_DIR, TEXT_LIMIT
from flask import send_from_directory
import os.path

# Imports for SVG Generation
import xml.etree.ElementTree as ET
from time import sleep, time
from urllib.parse import quote
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
app = Flask(__name__)
app.secret_key = os.urandom(24)

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "structured_data")
CONTENT_DIR = os.path.join(BASE_DIR, "content")
FONTS_DIR = os.path.join(BASE_DIR, "fonts")
STATIC_DIR = os.path.join(BASE_DIR, "static")
SVG_DIR = os.path.join(STATIC_DIR, "svgs")

# Create directories if they don't exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CONTENT_DIR, exist_ok=True)
os.makedirs(FONTS_DIR, exist_ok=True)
os.makedirs(SVG_DIR, exist_ok=True)

TEXTBOOKS_API = "https://staticapis.pragament.com/textbooks/allbooks.json"
TEXTBOOK_CACHE = os.path.join(DATA_DIR, 'textbook_cache.json')

SUBJECT_NAME_MAP_BY_CLASS = {
    "Mathematics": {
        "10": "Mathematics", "9": "Maths", "8": "Mathematics", "7": "Mathematics",
        "6": "Mathematics", "5": "Mathematics", "4": "Maths",
    }
}

# ------------------------------- Fill in the Blanks (FIB) Generation Functions -------------------------------

def generate_fib_content(subject, chapter, topic, subtopic):
    """Generates FIB content using Ollama and ensures valid JSON output."""
    prompt = f"""
You are an educational expert. Create a short paragraph (100-150 words) on the topic: {subtopic},
related to Chapter: {chapter}, Subject: {subject}, for grade 6 students. Then:

1. Replace 8 important keywords with blanks (like _______) in the paragraph.
2. Create a word bank of those 8 words.
3. Create 8 FIB questions (1 per blank) based on the paragraph.
4. Output as a JSON object with keys: "paragraph", "word_bank" (list), "questions" (list), and "answers" (list).
Only return a single, valid JSON object and nothing else.
    """
    try:
        response = ollama.chat(model="llama3", messages=[{"role": "user", "content": prompt}])
        content_str = response['message']['content']
        
        # Clean up potential markdown code fences
        if content_str.strip().startswith("```json"):
            content_str = content_str.strip()[7:-3].strip()
            
        return json.loads(content_str)
    except json.JSONDecodeError:
        logger.error("Failed to decode JSON from LLM for FIB content.")
        return {"error": "The AI model returned an invalid format. Please try again."}
    except Exception as e:
        logger.error(f"An unexpected error occurred during FIB content generation: {e}")
        return {"error": f"An unexpected error occurred: {e}"}

def generate_fib_pdf(content, filename, show_answers=False):
    """Generates a PDF for the Fill-in-the-Blanks worksheet based on the provided image layout."""
    doc = SimpleDocTemplate(filename, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm, leftMargin=1.5*cm, rightMargin=1.5*cm)
    styles = getSampleStyleSheet()

    # Custom styles to match the image
    styles.add(ParagraphStyle(name='Instructions', fontSize=8, leading=10))
    styles.add(ParagraphStyle(name='AnswerBank', fontSize=9, leading=12))
    styles.add(ParagraphStyle(name='MainParagraph', fontSize=9, leading=11))
    styles.add(ParagraphStyle(name='QuestionStyle', fontSize=9, leading=12))
    styles.add(ParagraphStyle(name='BoxChar', alignment=1, fontSize=9)) # Centered text for boxes

    story = []

    # --- Header Section ---
    instructions_text = """
    <b>Instructions for filling the sheet:</b><br/>
    • Don't fold the sheet. Use only ball pen. Read the given paragraph carefully.<br/>
    • Below the paragraph, you will find questions with blanks.<br/>
    • Use the Answer Bank provided to fill in the blanks with the most appropriate word(s).<br/>
    • Each word/phrase from the Answer Bank can be used only once, unless stated otherwise.<br/>
    • Write only the correct word(s) in the blank space provided.<br/>
    • Spelling errors may result in the loss of marks.<br/>
    • Do not use words that are not in the Answer Bank.<br/>
    • <b>Only use <i>UPPER CASE CAPITAL LETTER ALPHABETS</i> in the boxes.</b>
    """
    
    # --- Student Info Table ---
    admission_boxes = [[''] * 12]
    name_boxes = [[''] * 24]
    
    box_style = TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    
    admission_table = Table(admission_boxes, colWidths=[0.5*cm]*12, rowHeights=0.5*cm)
    admission_table.setStyle(box_style)
    
    name_table = Table(name_boxes, colWidths=[0.5*cm]*24, rowHeights=0.5*cm)
    name_table.setStyle(box_style)

    # Student Info Left Column
    left_info_data = [
        [Paragraph("<b>Admission number</b>", styles['Instructions'])],
        [admission_table],
        [Spacer(1, 0.2*cm)],
        [Paragraph("<b>Student Name</b>", styles['Instructions'])],
        [name_table],
        [Spacer(1, 0.2*cm)],
        [Paragraph("<b>Class (6,7,8,9)</b>      <b>Section</b>", styles['Instructions'])],
        [Spacer(1, 0.2*cm)],
        [Paragraph("<b>Date</b> dd/mm/yyyy", styles['Instructions'])],
    ]
    left_info_table = Table(left_info_data, colWidths=[8*cm])
    left_info_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))

    # Right Column (Paragraph)
    para_text = content.get("paragraph", "Paragraph could not be generated.")
    if show_answers:
        # Create a bold/underlined version for the answer key
        para_text_ans = content.get("paragraph", "Paragraph could not be generated.")
        for ans in content.get("answers", []):
            para_text_ans = para_text_ans.replace("_______", f"<b><u>{ans}</u></b>", 1)
        para_text = para_text_ans
            
    right_info_data = [
        [Paragraph(f"<b>Paragraph:</b> {para_text}", styles['MainParagraph'])]
    ]
    right_info_table = Table(right_info_data, colWidths=[10*cm])
    right_info_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOX', (0,0), (-1,-1), 0.5, colors.black), ('LEFTPADDING', (0,0), (-1,-1), 4), ('RIGHTPADDING', (0,0), (-1,-1), 4)]))
    
    # --- Top Layout Table ---
    header_data = [
        [Paragraph(instructions_text, styles['Instructions']), ''],
        [left_info_table, right_info_table]
    ]
    header_table = Table(header_data, colWidths=[8 * cm, 10.5 * cm])
    header_table.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('VALIGN', (0,1), (1,1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.5*cm))

    # --- Answer Bank ---
    answer_bank_words = content.get("word_bank", [])
    answer_bank_text = "<b>Answer bank:</b> " + ", ".join(word.upper() for word in answer_bank_words)
    story.append(Paragraph(answer_bank_text, styles['AnswerBank']))
    story.append(Spacer(1, 0.5*cm))

    # --- Questions Section ---
    questions = content.get("questions", [])
    answers = content.get("answers", [])
    
    question_data = []
    # Determine max answer length for box grid, with a minimum of 15
    max_answer_len = 15
    if answers:
        max_answer_len = max(max((len(ans) for ans in answers), default=0), 15)

    for i, q_text in enumerate(questions):
        answer_boxes_data = [['' for _ in range(max_answer_len)]]
        
        # Fill in the answer for the answer key
        if show_answers and i < len(answers):
            ans = answers[i]
            for j, char in enumerate(ans):
                if j < max_answer_len:
                    answer_boxes_data[0][j] = Paragraph(f"<b>{char.upper()}</b>", styles['BoxChar'])

        answer_table = Table(answer_boxes_data, colWidths=[0.5*cm]*max_answer_len, rowHeights=0.5*cm)
        answer_table.setStyle(box_style)

        # Structure: Question text on left, answer boxes on right
        row_data = [Paragraph(f"<b>Q{i+1}...</b> {q_text}", styles['QuestionStyle']), answer_table]
        question_data.append(row_data)

    question_table = Table(question_data, colWidths=[10*cm, (max_answer_len * 0.5 + 0.5)*cm])
    question_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (0,-1), 0),
    ]))
    story.append(question_table)
    story.append(Spacer(1, 1*cm))

    # --- Footer Signatures ---
    footer_data = [
        [Paragraph("Invigilator's Signature: __________________", styles['Normal']),
         Paragraph("Student's Signature: ____________________", styles['Normal'])]
    ]
    footer_table = Table(footer_data, colWidths=[9*cm, 9*cm])
    footer_table.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'LEFT')]))
    story.append(footer_table)

    # --- Build PDF with Markers ---
    def on_first_page(canvas, doc):
        canvas.saveState()
        marker_path = os.path.join(STATIC_DIR, "marker.png")
        if os.path.exists(marker_path):
            marker = ImageReader(marker_path)
            # Positions adjusted to be close to the corners of the page
            positions = [(0.5*cm, 28.2*cm), (20*cm, 28.2*cm), (0.5*cm, 0.5*cm), (20*cm, 0.5*cm)]
            for x, y in positions:
                canvas.drawImage(marker, x, y, width=0.8*cm, height=0.8*cm, mask='auto')
        else:
            logger.warning("marker.png not found in static folder. Skipping markers.")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_first_page)

# ------------------------------- SVG Generation Functions -------------------------------
SVG_NAMESPACE = "[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
DC_NAMESPACE = "[http://purl.org/dc/elements/1.1/](http://purl.org/dc/elements/1.1/)"
ET.register_namespace('', SVG_NAMESPACE)
ET.register_namespace('dc', DC_NAMESPACE)

MAX_RETRIES = 3
BASE_DELAY = 2  # seconds
GITHUB_API_DELAY = 1  # seconds between GitHub API requests

@retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=1, min=BASE_DELAY))
def safe_api_request(url, params=None):
    response = requests.get(url, params=params, headers={"User-Agent": "MyCoolTool/1.0"}, timeout=15)
    response.raise_for_status()
    return response

# ... (All your other SVG functions: fetch_topics, search_wikimedia_svg, etc. go here) ...
# Omitted for brevity, but you should keep them in your file.

# ------------------------------- Original App Functions -------------------------------

def normalize_subject(subject):
    subject = subject.strip().lower()
    subject_map = {
        'maths': 'Mathematics', 'mathematics': 'Mathematics', 'math': 'Mathematics',
        'science': 'Science', 'physics': 'Physics', 'chemistry': 'Chemistry', 'biology': 'Biology',
        'english': 'English', 'english language': 'English', 'english language and literature': 'English',
        'social science': 'Social Science', 'social studies': 'Social Science',
        'hindi': 'Hindi',
    }
    return subject_map.get(subject, subject.capitalize())

def normalize_class(class_name):
    class_name = str(class_name).strip().lower().replace('class ', '').replace('grade ', '')
    return class_name

def load_cached_textbooks():
    if not os.path.exists(TEXTBOOK_CACHE): return None
    try:
        with open(TEXTBOOK_CACHE, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load cached textbooks: {e}")
        return None

def save_cached_textbooks(textbooks):
    try:
        with open(TEXTBOOK_CACHE, 'w', encoding='utf-8') as f:
            json.dump(textbooks, f, indent=4)
        logger.info(f"Saved textbook cache to {TEXTBOOK_CACHE}")
    except Exception as e:
        logger.error(f"Failed to save textbook cache: {e}")

def fetch_textbooks_list(api_url):
    try:
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Exception while fetching textbooks: {e}")
        return None

# ... (All your other original helper functions: build_prerequisite_tree, generate_pdf, etc. go here) ...
# Omitted for brevity, but you should keep them in your file.

# ------------------------------- Routes ----------------------------------

@app.route('/')
def index():
    """Main homepage route."""
    try:
        textbooks_data = fetch_textbooks_list(TEXTBOOKS_API) or load_cached_textbooks()
        if textbooks_data and textbooks_data != load_cached_textbooks():
            save_cached_textbooks(textbooks_data)
        textbooks = textbooks_data.get('data', {}).get('getBooks', []) if textbooks_data else []
        if not textbooks:
            flash("Could not fetch textbook list from API or cache. Please check connectivity.", "error")
    except Exception as e:
        logger.error(f"Error in index route: {e}")
        textbooks = []
        flash("An unexpected error occurred on the homepage.", "error")
    return render_template('index.html', textbooks=textbooks, textbooks_json=json.dumps(textbooks))

# ... (All your other original routes: /select, /generate, /generate_questions, etc. go here) ...
# Omitted for brevity, but you should keep them in your file.

# ------------------------------- NEW FIB Generator Routes ----------------------------------

@app.route('/fib_generator', methods=['GET', 'POST'])
def fib_generator():
    if request.method == 'POST':
        subject = request.form.get('subject', '').strip()
        chapter = request.form.get('chapter', '').strip()
        topic = request.form.get('topic', '').strip()
        subtopic = request.form.get('subtopic', '').strip()

        if not all([subject, chapter, topic, subtopic]):
            flash("All fields are required. Please fill out the entire form.", "error")
            return redirect(url_for('fib_generator'))

        logger.info("Generating FIB content...")
        content = generate_fib_content(subject, chapter, topic, subtopic)

        if "error" in content:
            flash(content["error"], "error")
            return redirect(url_for('fib_generator'))

        base_name = f"FIB_{subject}_{chapter}_{subtopic}".replace(" ", "_").replace("/", "_")
        student_pdf_name = f"{base_name}_student.pdf"
        answer_pdf_name = f"{base_name}_answer.pdf"
        
        student_pdf_path = os.path.join(CONTENT_DIR, student_pdf_name)
        answer_pdf_path = os.path.join(CONTENT_DIR, answer_pdf_name)

        try:
            logger.info(f"Generating student PDF: {student_pdf_path}")
            generate_fib_pdf(content, student_pdf_path, show_answers=False)
            logger.info(f"Generating answer key PDF: {answer_pdf_path}")
            generate_fib_pdf(content, answer_pdf_path, show_answers=True)
            logger.info("PDF generation complete.")
            
            flash("Worksheets generated successfully!", "success")
            return render_template("fib_generator.html", success=True,
                                   student_pdf=student_pdf_name,
                                   answer_pdf=answer_pdf_name)
        except Exception as e:
            logger.error(f"Failed to generate PDFs: {e}")
            flash(f"An error occurred while creating the PDF files: {e}", "error")
            return redirect(url_for('fib_generator'))

    return render_template('fib_generator.html', success=False)

@app.route('/download_fib/<path:filename>')
def download_fib(filename):
    """Serves a generated FIB PDF from the content directory."""
    return send_from_directory(CONTENT_DIR, filename, as_attachment=True)


if __name__ == '__main__':
    app.run(debug=True)
