import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export default function NotesWindow(props) {
  let windowHandle;
  let w = window.open('', 'Notes');
  copyStyles(window.document, w.document);
  windowHandle = w;
  windowHandle.onunload = () => props.onClose();

  function copyStyles(source, target) {
    Array.from(source.querySelectorAll('link[rel="stylesheet"], style'))
    .forEach(link => target.head.appendChild(link.cloneNode(true)));
  }

  if (windowHandle)
    return ReactDOM.createPortal(props.children, windowHandle.document.body);
}