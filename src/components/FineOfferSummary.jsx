import React from 'react';
import {FINE_OFFER} from '../lib/fineOffer.js';

export default function FineOfferSummary({showScope=false}) {
  return <div className="rtm-fine-offer">
    <strong>{FINE_OFFER.headline}</strong>
    <p>{FINE_OFFER.terms}</p>
    <p>{FINE_OFFER.explanation}</p>
    {showScope&&<><p>{FINE_OFFER.basicScope}</p><p>{FINE_OFFER.exclusions}</p></>}
  </div>;
}
