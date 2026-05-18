'use client';
/**
 * Client view for `/dev/modules-preview` — App Router migration, Batch 6.
 * `ModulesPreview` is the AdminLoader bridge; it resolves `t` / `tApp`
 * itself via `useTranslation`, so this dev route renders it with no
 * props (same as the dispatch path).
 */
import React from 'react';
import ModulesPreview from '@client/lib/preview/ModulesPreview';

const DevModulesPreviewView: React.FC = () => <ModulesPreview/>;

export default DevModulesPreviewView;
