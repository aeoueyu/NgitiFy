import React from 'react';
import { FaLock, FaPaperPlane, FaRobot, FaSearch, FaStethoscope } from 'react-icons/fa';
import styles from '../../styles/dentist/DentistAIAssistant.module.css';

const SUGGESTED_PROMPTS = [
    'Summarize today’s patient workload and follow-up priorities.',
    'What materials are commonly needed for a root canal treatment?',
    'Show me the steps for logging a radiograph inside NgitiFy.',
    'Draft post-operative reminders for an extraction patient.',
];

export default function DentistAIAssistant() {
    return (
        <main className={styles.page}>
            <section className={styles.heroCard}>
                <div className={styles.heroIconWrap}>
                    <FaRobot className={styles.heroIcon} />
                </div>
                <div>
                    <p className={styles.eyebrow}>AI Staff Assistant</p>
                    <h1 className={styles.title}>Dentist-side AI workspace preview</h1>
                    <p className={styles.subtitle}>
                        This frontend preview shows how the dentist AI assistant will look once the guided
                        work-helper experience is finalized. The live AI workflow is intentionally not enabled here yet.
                    </p>
                </div>
                <div className={styles.statusBadge}>
                    <FaLock />
                    Frontend Only
                </div>
            </section>

            <section className={styles.mainGrid}>
                <article className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <FaSearch className={styles.panelIcon} />
                        <div>
                            <h2 className={styles.panelTitle}>Suggested Requests</h2>
                            <p className={styles.panelText}>Example prompts dentists can use once the assistant is fully wired.</p>
                        </div>
                    </div>

                    <div className={styles.promptList}>
                        {SUGGESTED_PROMPTS.map((prompt) => (
                            <button key={prompt} type="button" className={styles.promptChip}>
                                {prompt}
                            </button>
                        ))}
                    </div>
                </article>

                <article className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <FaStethoscope className={styles.panelIcon} />
                        <div>
                            <h2 className={styles.panelTitle}>Planned Help Scope</h2>
                            <p className={styles.panelText}>The assistant is planned to support workflow-aware dentist questions such as:</p>
                        </div>
                    </div>

                    <ul className={styles.scopeList}>
                        <li>finding patient-related actions inside NgitiFy without manual screen hunting</li>
                        <li>surfacing documentation steps for treatment logs, radiographs, and odontogram updates</li>
                        <li>suggesting workflow reminders for procedures, scheduling, and material usage recording</li>
                        <li>turning plain-language questions into clearer system guidance for front-desk and clinical tasks</li>
                    </ul>
                </article>
            </section>

            <section className={styles.chatShell}>
                <div className={styles.chatHeader}>
                    <FaRobot className={styles.chatHeaderIcon} />
                    <div>
                        <h2 className={styles.chatTitle}>Preview Conversation Area</h2>
                        <p className={styles.chatSubtitle}>Layout only. Messages are not sent yet in this dentist preview.</p>
                    </div>
                </div>

                <div className={styles.mockMessages}>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        I’ll eventually help you find workflow steps, summarize records, and surface system instructions faster.
                    </div>
                    <div className={`${styles.messageBubble} ${styles.userBubble}`}>
                        Show me where to review recent radiographs for my assigned patients.
                    </div>
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                        Planned response: guide you to the patient EMR list, open the selected patient, and jump to the radiographs tab.
                    </div>
                </div>

                <div className={styles.inputRow}>
                    <div className={styles.disabledInput}>Ask the AI assistant about your dentist workflow...</div>
                    <button type="button" className={styles.sendBtn} disabled>
                        <FaPaperPlane />
                    </button>
                </div>
            </section>
        </main>
    );
}
