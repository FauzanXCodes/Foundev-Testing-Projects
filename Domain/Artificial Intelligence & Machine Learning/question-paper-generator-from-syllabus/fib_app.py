from flask import Flask, render_template, request, send_file
from generator import generate_fib_content, generate_fib_pdf
import os

app = Flask(__name__)
OUTPUT_DIR = "generated_pdfs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        subject = request.form["subject"]
        chapter = request.form["chapter"]
        topic = request.form["topic"]
        subtopic = request.form["subtopic"]

        content = generate_fib_content(subject, chapter, topic, subtopic)
        base_name = f"{subject}_{chapter}_{topic}_{subtopic}".replace(" ", "_")
        student_pdf = os.path.join(OUTPUT_DIR, f"{base_name}_student.pdf")
        answer_pdf = os.path.join(OUTPUT_DIR, f"{base_name}_answer.pdf")

        generate_fib_pdf(content, student_pdf, show_answers=False)
        generate_fib_pdf(content, answer_pdf, show_answers=True)

        return render_template("ifib_index.html", success=True,
                               student_pdf=student_pdf,
                               answer_pdf=answer_pdf)

    return render_template("fib_index.html")

@app.route("/download/<filename>")
def download(filename):
    return send_file(os.path.join(OUTPUT_DIR, filename), as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True)
