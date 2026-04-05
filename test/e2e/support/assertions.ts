export const expectMeta = (body: any, options?: { requestId?: string }) => {
  expect(body.meta).toEqual(
    expect.objectContaining({
      timestamp: expect.any(String),
      requestId: options?.requestId ?? expect.any(String),
    }),
  );
};

export const expectSuccessEnvelope = (
  body: any,
  options?: { message?: string; hasData?: boolean; requestId?: string },
) => {
  expect(body.success).toBe(true);

  if (options?.message) {
    expect(body.message).toBe(options.message);
  } else {
    expect(body.message).toEqual(expect.any(String));
  }

  if (options?.hasData === false) {
    expect(body.data).toBeUndefined();
  }

  expectMeta(body, { requestId: options?.requestId });
};

export const expectErrorEnvelope = (
  body: any,
  options: { code: string; message?: string },
) => {
  expect(body.success).toBe(false);
  expect(body.error).toEqual(expect.objectContaining({ code: options.code }));

  if (options.message) {
    expect(body.message).toBe(options.message);
  } else {
    expect(body.message).toEqual(expect.any(String));
  }

  expectMeta(body);
};
