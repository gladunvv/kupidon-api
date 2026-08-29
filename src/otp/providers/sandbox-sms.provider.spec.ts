import { SandboxSmsProvider } from './sandbox-sms.provider';

describe('SandboxSmsProvider', () => {
  it('always reports success without contacting any real network', async () => {
    const provider = new SandboxSmsProvider();

    const result = await provider.send('+79990001122', 'code: 1234');

    expect(result).toEqual({
      success: true,
      providerMessageId: expect.any(String),
    });
  });

  it('records sent messages for inspection in dev/tests', async () => {
    const provider = new SandboxSmsProvider();

    await provider.send('+79990001122', 'code: 1234');
    await provider.send('+79990003344', 'code: 5678');

    const sent = provider.getSentMessages();
    expect(sent).toHaveLength(2);
    expect(sent[0].phoneNumber).toBe('+79990001122');
    expect(sent[1].phoneNumber).toBe('+79990003344');
  });

  it('does not log the phone number or message body', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    const provider = new SandboxSmsProvider();
    await provider.send('+79990001122', 'code: 1234');

    const loggedText = stdoutSpy.mock.calls.flat().join(' ');
    expect(loggedText).not.toContain('+79990001122');
    expect(loggedText).not.toContain('1234');

    stdoutSpy.mockRestore();
  });

  it('clears recorded messages on reset', async () => {
    const provider = new SandboxSmsProvider();
    await provider.send('+79990001122', 'code: 1234');

    provider.reset();

    expect(provider.getSentMessages()).toHaveLength(0);
  });
});
