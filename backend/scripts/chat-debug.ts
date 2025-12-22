#!/usr/bin/env ts-node
/**
 * AI Chat Debug Tool
 * 直接与AI对话，测试工具调用和功能
 * 
 * 使用方法:
 * npm run chat:debug
 * 
 * 或直接运行:
 * ts-node scripts/chat-debug.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { AIChatService } from '../src/ai-chat/ai-chat.service';
import * as readline from 'readline';

async function bootstrap() {
    console.log('🚀 启动 AI Chat 调试工具...\n');

    // 创建 NestJS 应用
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'], // 显示日志以便调试
    });

    const prisma = app.get(PrismaService);
    const aiChatService = app.get(AIChatService);

    // 获取或创建测试用户
    let user = await prisma.user.findFirst({
        where: { openId: 'debug_openid' },
    });

    if (!user) {
        console.log('创建调试用户...');
        user = await prisma.user.create({
            data: {
                openId: 'debug_openid',
                nickname: 'Debug User',
            },
        });
    }

    console.log(`✅ 用户: ${user.nickname} (ID: ${user.id})\n`);

    // 创建对话会话
    console.log('创建新的对话会话...');
    const sessionData = await aiChatService.createSession(user.id, {
        scene: 'general_chat',
    });

    console.log(`✅ 会话创建成功 (ID: ${sessionData.sessionId})`);
    console.log(`📋 欢迎消息: ${sessionData.welcomeMessage}\n`);
    console.log('='.repeat(60));
    console.log('💬 开始对话（输入 "exit" 退出, "history" 查看历史, "clear" 清空屏幕）');
    console.log('='.repeat(60));
    console.log();

    // 创建 readline 接口
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '\n👤 你: ',
    });

    let conversationTurn = 0;
    let isCleaningUp = false;

    // 清理函数
    const cleanup = async () => {
        if (isCleaningUp) {
            return; // 防止重复清理
        }
        isCleaningUp = true;

        try {
            console.log('\n🧹 清理测试数据...');

            // 清理测试数据
            await prisma.aIMessage.deleteMany({
                where: { sessionId: sessionData.sessionId },
            });
            await prisma.aISession.delete({
                where: { id: sessionData.sessionId },
            });

            // 清理测试用户
            await prisma.user.delete({
                where: { id: user.id },
            }).catch((err) => {
                // 如果删除失败（可能已被其他进程删除），忽略错误
                console.warn('⚠️  清理用户时出现警告（可忽略）:', err.message);
            });

            await app.close();
        } catch (error) {
            console.error('❌ 清理过程中出现错误:', error.message);
        }
    };

    // 注册信号处理器（Ctrl+C 和终止信号）
    const signalHandler = async (signal: string) => {
        console.log(`\n\n收到 ${signal} 信号，正在退出...`);
        await cleanup();
        process.exit(0);
    };

    process.on('SIGINT', () => signalHandler('SIGINT'));
    process.on('SIGTERM', () => signalHandler('SIGTERM'));

    rl.prompt();

    rl.on('line', async (line: string) => {
        const message = line.trim();

        // 处理特殊命令
        if (message === 'exit' || message === 'quit') {
            console.log('\n👋 再见！');
            await cleanup();
            rl.close();
            process.exit(0);
        }

        if (message === 'clear') {
            console.clear();
            console.log('='.repeat(60));
            console.log('💬 继续对话');
            console.log('='.repeat(60));
            rl.prompt();
            return;
        }

        if (message === 'history') {
            console.log('\n📚 对话历史:');
            const history = await aiChatService.getHistory(
                user.id,
                sessionData.sessionId,
            );

            history.messages.forEach((msg, index) => {
                const role = msg.role === 'user' ? '👤 你' : '🤖 AI';
                const content = msg.content
                    .map((c: any) => {
                        if (c.type === 'text') return c.data;
                        if (c.type === 'component') return `[${c.componentType}组件]`;
                        return '[其他内容]';
                    })
                    .join(' ');

                console.log(`${index + 1}. ${role}: ${content}`);
            });

            console.log();
            rl.prompt();
            return;
        }

        if (!message) {
            rl.prompt();
            return;
        }

        conversationTurn++;
        console.log(`\n--- 第 ${conversationTurn} 轮对话 ---`);

        // 发送消息并获取流式响应
        let aiResponseText = '';
        let hasComponents = false;
        let toolCallsDetected = 0;

        try {
            console.log('🤖 AI: ', '');
            process.stdout.write(''); // 准备流式输出

            const stream = aiChatService.streamChat(user.id, sessionData.sessionId, {
                message,
                clientContext: {
                    localTime: new Date().toISOString(),
                },
            });

            // 订阅流式响应
            await new Promise<void>((resolve, reject) => {
                stream.subscribe({
                    next: (event: any) => {
                        const data = event.data;

                        // 解析 SSE 数据
                        const lines = data.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('event:')) {
                                const eventType = line.substring(6).trim();

                                if (eventType === 'text') {
                                    // 查找数据行
                                    const dataLine = lines.find((l: string) => l.startsWith('data:'));
                                    if (dataLine) {
                                        try {
                                            const jsonData = JSON.parse(dataLine.substring(5));
                                            if (jsonData.text) {
                                                process.stdout.write(jsonData.text);
                                                aiResponseText += jsonData.text;
                                            }
                                        } catch (e) {
                                            // 忽略解析错误
                                        }
                                    }
                                } else if (eventType === 'component') {
                                    if (!hasComponents) {
                                        console.log('\n\n📊 组件:');
                                        hasComponents = true;
                                    }

                                    const dataLine = lines.find((l: string) => l.startsWith('data:'));
                                    if (dataLine) {
                                        try {
                                            const segment = JSON.parse(dataLine.substring(5));
                                            // segment 是一个 ContentSegment，type 可能是 'card_dish', 'card_canteen', 'card_plan' 或 'text'
                                            const segmentType = segment.type || 'unknown';
                                            const dataPreview = JSON.stringify(segment.data).substring(0, 100);
                                            console.log(`  - ${segmentType}: ${dataPreview}...`);
                                            toolCallsDetected++;
                                        } catch (e) {
                                            // 忽略
                                        }
                                    }
                                } else if (eventType === 'error') {
                                    const dataLine = lines.find((l: string) => l.startsWith('data:'));
                                    if (dataLine) {
                                        try {
                                            const error = JSON.parse(dataLine.substring(5));
                                            console.error(`\n❌ 错误: ${error.error}`);
                                        } catch (e) {
                                            // 忽略
                                        }
                                    }
                                }
                            }
                        }
                    },
                    complete: () => {
                        console.log(); // 换行

                        if (toolCallsDetected > 0) {
                            console.log(`\n🔧 检测到 ${toolCallsDetected} 个工具调用`);
                        }

                        resolve();
                    },
                    error: (err) => {
                        console.error('\n❌ 流式响应错误:', err.message);
                        reject(err);
                    },
                });
            });

            console.log();
        } catch (error) {
            console.error('❌ 发送消息失败:', error.message);
        }

        rl.prompt();
    });

    rl.on('close', async () => {
        await cleanup();
        process.exit(0);
    });
}

bootstrap().catch((error) => {
    console.error('启动失败:', error);
    process.exit(1);
});
