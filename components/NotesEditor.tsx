"use client";

import { useEffect, useImperativeHandle, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export type NotesEditorRef = {
  clear: () => void;
};

type NotesEditorProps = {
  initialContent?: string;
  onChange?: (html: string) => void;
};

const NotesEditor = forwardRef<NotesEditorRef, NotesEditorProps>(
  ({ initialContent = "", onChange }, ref) => {
    const editor = useEditor({
      extensions: [StarterKit],
      content: initialContent,
      immediatelyRender: false,
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    });

    // expose `clear()` to parent
    useImperativeHandle(ref, () => ({
      clear: () => {
        editor?.commands.clearContent(true);
      },
    }));

    useEffect(() => () => editor?.destroy(), [editor]);

    return (
      <div className="border rounded-lg p-2">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`px-2 py-1 border rounded ${
              editor?.isActive("bold") ? "bg-gray-200" : ""
            }`}
          >
            Bold
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 border rounded ${
              editor?.isActive("italic") ? "bg-gray-200" : ""
            }`}
          >
            Italic
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            className={`px-2 py-1 border rounded ${
              editor?.isActive("codeBlock") ? "bg-gray-200" : ""
            }`}
          >
            Code
          </button>
          <button
            onClick={() => editor?.chain().focus().setParagraph().run()}
            className="px-2 py-1 border rounded"
          >
            P
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 border rounded ${
              editor?.isActive("bulletList") ? "bg-gray-200" : ""
            }`}
          >
            • List
          </button>
        </div>

        <EditorContent
          editor={editor}
          className="prose max-w-none min-h-[160px] p-2"
        />
      </div>
    );
  }
);

NotesEditor.displayName = "NotesEditor";

export default NotesEditor;
