'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { useAuth } from './auth-context';

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended';

interface PhoneContextValue {
  callState: CallState;
  activeCall: Call | null;
  callingNumber: string;
  callingName: string;
  callingLeadId: string;
  callDuration: number;
  isMuted: boolean;
  isDesktop: boolean;
  hasNumber: boolean;
  makeCall: (phone: string, name: string, leadId: string) => void;
  hangUp: () => void;
  toggleMute: () => void;
  logOutcome: (outcome: string) => void;
}

const PhoneContext = createContext<PhoneContextValue | null>(null);

export function PhoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callingNumber, setCallingNumber] = useState('');
  const [callingName, setCallingName] = useState('');
  const [callingLeadId, setCallingLeadId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;

  // Initialize Twilio Device
  useEffect(() => {
    if (!user || !isDesktop) return;

    async function initDevice() {
      try {
        const res = await fetch('/api/twilio/token');
        if (!res.ok) return;
        const { token, twilioNumber: num } = await res.json();
        setTwilioNumber(num);

        if (deviceRef.current) {
          deviceRef.current.destroy();
        }

        const device = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          logLevel: 1,
        });

        device.on('registered', () => {
          console.log('[Phone] Device registered');
        });

        device.on('error', (err) => {
          console.error('[Phone] Device error:', err);
          setCallState('idle');
        });

        device.on('tokenWillExpire', async () => {
          const res = await fetch('/api/twilio/token');
          if (res.ok) {
            const { token } = await res.json();
            device.updateToken(token);
          }
        });

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        console.error('[Phone] Init error:', err);
      }
    }

    initDevice();

    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const makeCall = useCallback((phone: string, name: string, leadId: string) => {
    const device = deviceRef.current;

    // Mobile fallback — use tel: link
    if (!device || !isDesktop) {
      window.location.href = `tel:${phone}`;
      return;
    }

    setCallingNumber(phone);
    setCallingName(name);
    setCallingLeadId(leadId);
    setCallState('connecting');
    setCallDuration(0);
    setIsMuted(false);

    const params: Record<string, string> = {
      To: phone,
    };
    if (twilioNumber) {
      params.callerId = twilioNumber;
    }

    device.connect({ params }).then((call) => {
      callRef.current = call;
      setActiveCall(call);

      call.on('ringing', () => setCallState('ringing'));
      call.on('accept', () => {
        setCallState('in-call');
        // Start duration timer
        timerRef.current = setInterval(() => {
          setCallDuration((d) => d + 1);
        }, 1000);
      });
      call.on('disconnect', () => {
        setCallState('ended');
        if (timerRef.current) clearInterval(timerRef.current);
        callRef.current = null;
        setActiveCall(null);
      });
      call.on('cancel', () => {
        setCallState('idle');
        if (timerRef.current) clearInterval(timerRef.current);
        callRef.current = null;
        setActiveCall(null);
      });
      call.on('error', () => {
        setCallState('idle');
        if (timerRef.current) clearInterval(timerRef.current);
      });
    }).catch((err) => {
      console.error('[Phone] Connect error:', err);
      setCallState('idle');
    });
  }, [isDesktop, twilioNumber]);

  const hangUp = useCallback(() => {
    callRef.current?.disconnect();
    if (timerRef.current) clearInterval(timerRef.current);
    setCallState('ended');
    callRef.current = null;
    setActiveCall(null);
  }, []);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const newMuted = !isMuted;
    call.mute(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const logOutcome = useCallback(async (outcome: string) => {
    if (!callingLeadId) return;

    // Log to activities
    const { supabase } = await import('./supabase');
    await supabase.from('activities').insert({
      lead_id: callingLeadId,
      type: 'call',
      title: `Call: ${outcome}`,
      outcome,
      metadata: {
        phone: callingNumber,
        duration: callDuration,
        direction: 'outbound',
        method: 'browser',
      },
    });

    // Update lead status based on outcome
    const statusMap: Record<string, string> = {
      'No Answer': 'Called',
      'Left VM': 'Called',
      'Spoke': 'Interested',
      'Follow-Up': 'Follow-Up',
      'Not Int.': 'Not Interested',
      'DNC': 'Do Not Call',
    };
    const newStatus = statusMap[outcome];
    if (newStatus) {
      await supabase.from('leads').update({
        status: newStatus,
        last_contact_date: new Date().toISOString(),
      }).eq('id', callingLeadId);
    }

    // Reset call state
    setCallState('idle');
    setCallingNumber('');
    setCallingName('');
    setCallingLeadId('');
    setCallDuration(0);
  }, [callingLeadId, callingNumber, callDuration]);

  return (
    <PhoneContext.Provider value={{
      callState,
      activeCall,
      callingNumber,
      callingName,
      callingLeadId,
      callDuration,
      isMuted,
      isDesktop,
      hasNumber: !!twilioNumber,
      makeCall,
      hangUp,
      toggleMute,
      logOutcome,
    }}>
      {children}
    </PhoneContext.Provider>
  );
}

export function usePhone() {
  const ctx = useContext(PhoneContext);
  if (!ctx) throw new Error('usePhone must be used within PhoneProvider');
  return ctx;
}
