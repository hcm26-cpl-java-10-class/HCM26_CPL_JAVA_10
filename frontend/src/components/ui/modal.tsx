import React from "react";
import { AnimatePresence, motion, easeInOut } from "framer-motion";

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}> = ({ open, onClose, title, size = "md", children }) => {
  const sizeClass =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-2xl";

  // variants for panel (fade + slide + scale)
  const panelVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: easeInOut } },
    exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: 0.15, ease: easeInOut } },
  };

  // backdrop variants (fade)
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.22 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            onClick={onClose}
          />

          {/* panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full mx-4 ${sizeClass} `}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={panelVariants}
          >
            <motion.div
              className="bg-card text-foreground rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()} 
              whileTap={{ scale: 0.999 }}
            >
              <header className="px-6 py-4 border-b bg-muted">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md p-1 transition"
                  >
                    ×
                  </button>
                </div>
              </header>

              <div className="p-6">{children}</div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
