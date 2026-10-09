// Upload de imagem pro bucket público e validação de tipo/tamanho.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upload = vi.fn();
const getPublicUrl = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: vi.fn(() => ({ upload, getPublicUrl })) } } }));

import { uploadPublicImage, validateImage, UPLOADS_BUCKET } from '@/lib/uploadImage';
import { supabase } from '@/integrations/supabase/client';

describe('uploadImage', () => {
  beforeEach(() => { upload.mockReset(); getPublicUrl.mockReset(); });

  it('sobe com upsert no caminho pasta/chave-timestamp.ext e devolve a URL pública', async () => {
    upload.mockResolvedValueOnce({ error: null });
    getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://cdn/x.PNG' } });
    const file = new File(['x'], 'Logo.PNG', { type: 'image/png' });
    const url = await uploadPublicImage('logos', file, 'office-1');
    expect(url).toBe('https://cdn/x.PNG');
    expect(supabase.storage.from).toHaveBeenCalledWith(UPLOADS_BUCKET);
    const [path, f, opts] = upload.mock.calls[0];
    expect(path).toMatch(/^logos\/office-1-\d+\.png$/);
    expect(f).toBe(file);
    expect(opts).toEqual({ upsert: true, cacheControl: '3600', contentType: 'image/png' });
    expect(getPublicUrl).toHaveBeenCalledWith(path);
  });

  it('erro do storage propaga; arquivo sem extensão vira .png', async () => {
    upload.mockResolvedValueOnce({ error: new Error('bucket ausente') });
    await expect(uploadPublicImage('logos', new File(['x'], 'semext', { type: '' }), 'k')).rejects.toThrow('bucket ausente');
    expect(upload.mock.calls[0][0]).toMatch(/\.semext$/); // sem ponto, o "nome" vira a extensão (comportamento atual)
    expect(upload.mock.calls[0][2].contentType).toBeUndefined();
  });

  it('validateImage: só imagem e dentro do limite', () => {
    expect(validateImage(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe('Selecione um arquivo de imagem.');
    const grande = new File([new Uint8Array(2 * 1024 * 1024)], 'a.png', { type: 'image/png' });
    expect(validateImage(grande, 1)).toBe('Imagem muito grande (máx 1MB).');
    expect(validateImage(grande)).toBeNull();
  });
});
