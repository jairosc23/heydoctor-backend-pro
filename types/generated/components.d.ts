import type { Schema, Attribute } from '@strapi/strapi';

export interface AgendaTimeSlots extends Schema.Component {
  collectionName: 'components_agenda_time_slots';
  info: {
    displayName: 'time slots';
    icon: 'apps';
  };
  attributes: {
    startDateTime: Attribute.DateTime;
    endDateTime: Attribute.DateTime;
  };
}

export interface ProfileAccountSettings extends Schema.Component {
  collectionName: 'components_profile_account_settings';
  info: {
    displayName: 'accountSettings';
    icon: 'cog';
  };
  attributes: {
    payment_type: Attribute.Enumeration<['daily', 'weekly', 'monthly']>;
    payment_method: Attribute.Component<'profile.payment-methods', true>;
  };
}

export interface ProfileExperience extends Schema.Component {
  collectionName: 'components_profile_experiences';
  info: {
    displayName: 'experience';
    icon: 'doctor';
  };
  attributes: {
    title: Attribute.String;
    files: Attribute.Media & Attribute.Required;
    title_type: Attribute.Enumeration<
      ['associate', 'bachelor', 'master', 'doctoral']
    > &
      Attribute.DefaultTo<'bachelor'>;
  };
}

export interface ProfileLanguages extends Schema.Component {
  collectionName: 'components_profile_languages';
  info: {
    displayName: 'languages';
    icon: 'earth';
    description: '';
  };
  attributes: {
    proficiency: Attribute.Enumeration<
      ['beginner', 'intermediate', 'advanced', 'native']
    >;
    primary_language: Attribute.Boolean;
    language: Attribute.Relation<
      'profile.languages',
      'oneToOne',
      'api::language.language'
    >;
  };
}

export interface ProfileMessages extends Schema.Component {
  collectionName: 'components_profile_messages';
  info: {
    displayName: 'messages';
    icon: 'message';
    description: '';
  };
  attributes: {
    text: Attribute.Text;
    duration: Attribute.BigInteger;
  };
}

export interface ProfilePaymentMethods extends Schema.Component {
  collectionName: 'components_profile_payment_methods';
  info: {
    displayName: 'paymentMethods';
    icon: 'house';
  };
  attributes: {
    active: Attribute.Boolean & Attribute.DefaultTo<false>;
  };
}

export interface ServiceExtraRates extends Schema.Component {
  collectionName: 'components_service_extra_rates';
  info: {
    displayName: 'extra rates';
    icon: 'plus';
  };
  attributes: {
    minimum: Attribute.Integer;
    maximum: Attribute.Integer;
    fixed: Attribute.Boolean & Attribute.DefaultTo<false>;
    title: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'agenda.time-slots': AgendaTimeSlots;
      'profile.account-settings': ProfileAccountSettings;
      'profile.experience': ProfileExperience;
      'profile.languages': ProfileLanguages;
      'profile.messages': ProfileMessages;
      'profile.payment-methods': ProfilePaymentMethods;
      'service.extra-rates': ServiceExtraRates;
    }
  }
}
