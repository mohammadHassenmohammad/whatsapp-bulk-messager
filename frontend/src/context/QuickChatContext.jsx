import React, { createContext, useContext, useState } from 'react';
import { QuickChatModal } from '../components/QuickChatModal';
import { ComplianceGuideModal } from '../components/ComplianceGuideModal';

const QuickChatContext = createContext();

export const QuickChatProvider = ({ children }) => {
  const [quickChatState, setQuickChatState] = useState({
    isOpen: false,
    customer: null,
    phone: '',
    message: '',
    mediaUrl: '',
    buttons: [],
  });

  const [guideOpen, setGuideOpen] = useState(false);

  const openQuickChat = ({ customer = null, phone = '', message = '', mediaUrl = '', buttons = [] } = {}) => {
    setQuickChatState({
      isOpen: true,
      customer,
      phone,
      message,
      mediaUrl,
      buttons,
    });
  };

  const closeQuickChat = () => {
    setQuickChatState((prev) => ({ ...prev, isOpen: false }));
  };

  const openComplianceGuide = () => {
    setGuideOpen(true);
  };

  const closeComplianceGuide = () => {
    setGuideOpen(false);
  };

  return (
    <QuickChatContext.Provider
      value={{
        openQuickChat,
        closeQuickChat,
        openComplianceGuide,
        closeComplianceGuide,
      }}
    >
      {children}
      <QuickChatModal
        isOpen={quickChatState.isOpen}
        onClose={closeQuickChat}
        initialCustomer={quickChatState.customer}
        initialPhone={quickChatState.phone}
        initialMessage={quickChatState.message}
        initialMediaUrl={quickChatState.mediaUrl}
        initialButtons={quickChatState.buttons}
      />
      <ComplianceGuideModal
        isOpen={guideOpen}
        onClose={closeComplianceGuide}
      />
    </QuickChatContext.Provider>
  );
};

export const useQuickChat = () => {
  const context = useContext(QuickChatContext);
  if (!context) {
    throw new Error('useQuickChat must be used within a QuickChatProvider');
  }
  return context;
};
