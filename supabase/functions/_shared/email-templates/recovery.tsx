/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  recipient?: string
  token?: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password. Click the button below to choose a new one.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={confirmationUrl} style={button}>
            Reset password
          </Button>
        </Section>
        <Text style={text}>
          Or copy and paste this link into your browser:
        </Text>
        <Text style={linkText}>
          <Link href={confirmationUrl} style={{ color: 'hsl(246, 65%, 56%)' }}>{confirmationUrl}</Link>
        </Text>
        <Text style={text}>
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          For your security, never share this link with anyone. {siteName} will never ask you for it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const brandBar = { padding: '16px 0', borderBottom: '2px solid hsl(246, 65%, 56%)', marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(246, 65%, 56%)', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(222, 84%, 4.9%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(215, 16.3%, 46.9%)', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: 'hsl(246, 65%, 56%)',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const linkText = { fontSize: '13px', color: 'hsl(215, 16.3%, 46.9%)', wordBreak: 'break-all' as const, margin: '0 0 20px' }
const hr = { borderColor: 'hsl(214, 31.8%, 91.4%)', margin: '28px 0 20px' }
const footer = { fontSize: '12px', color: 'hsl(215, 16.3%, 46.9%)', margin: '0' }
